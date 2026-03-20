import { useCallback } from "react"
import { Alert } from "react-native"
import * as ImagePicker from "expo-image-picker"
import { evaluateSubmitReadinessFromDraft } from "../../app/ibp-scoring"
import { getSubmitBlockReason } from "../../app/survey-logic"
import {
  discardSurveyLocalChanges,
  getLocalSurveyDraft,
  LocalSurvey,
  markSurveyExpiredLocally,
  queueDeleteAttachment,
  queueDeleteSurvey,
  queueLocalAttachment,
  retrySurveyNow,
  submitSurvey,
  syncPending,
  updateSurveyVisibility,
} from "../../storage"
import { AUTH_REQUIRED_ERROR } from "../useAuthSession"
import { formatSubmitReadinessError, guessMimeType, isUnauthorizedResultMessage } from "./utils"

type UseSurveySyncSurveyOperationsParams = {
  apiUrl: string
  accessToken: string
  refreshToken: string
  selectedSurveyId: string | null
  editingSurveyId: string | null
  surveys: LocalSurvey[]
  clearSession: () => Promise<void>
  refreshSessionTokens: (
    tokenOverride?: string,
  ) => Promise<{ accessToken: string; refreshToken: string } | null>
  withAuthRetry: <T>(operation: (token: string) => Promise<T>) => Promise<T>
  refreshLocalSurveys: () => Promise<void>
  refreshLocalAttachments: () => Promise<void>
  onCloseSurveyDetail: () => void
  onStopEditing: () => void
  setStatus: (message: string) => void
  maybeAutoSync: (trigger: string) => Promise<void>
  handleLoadCanonicalDetails: (surveyId: string, options?: { silent?: boolean }) => Promise<void>
}

export function useSurveySyncSurveyOperations({
  apiUrl,
  accessToken,
  refreshToken,
  selectedSurveyId,
  editingSurveyId,
  surveys,
  clearSession,
  refreshSessionTokens,
  withAuthRetry,
  refreshLocalSurveys,
  refreshLocalAttachments,
  onCloseSurveyDetail,
  onStopEditing,
  setStatus,
  maybeAutoSync,
  handleLoadCanonicalDetails,
}: UseSurveySyncSurveyOperationsParams) {
  const queueAttachmentAsset = useCallback(
    async (
      surveyId: string,
      asset: ImagePicker.ImagePickerAsset,
      source: "camera" | "library",
    ): Promise<void> => {
      const mimeType = asset.mimeType ?? guessMimeType(asset.uri)
      const sizeBytes =
        typeof asset.fileSize === "number" && asset.fileSize > 0 ? asset.fileSize : 500_000

      await queueLocalAttachment({
        survey_id: surveyId,
        local_uri: asset.uri,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        captured_at: new Date().toISOString(),
        metadata: {
          source,
          file_name: asset.fileName ?? null,
          width: asset.width ?? null,
          height: asset.height ?? null,
        },
      })

      await refreshLocalAttachments()
      setStatus(`${source === "camera" ? "Camera photo" : "Photo"} queued for survey ${surveyId}`)
      void maybeAutoSync("attachment-queued")
    },
    [maybeAutoSync, refreshLocalAttachments, setStatus],
  )

  const handleSubmitSurvey = useCallback(
    async (surveyId: string): Promise<void> => {
      const blockReason = getSubmitBlockReason(surveyId, surveys)
      if (blockReason === "not_found") {
        setStatus(`Survey not found locally: ${surveyId}`)
        return
      }
      if (blockReason === "global_blocked") {
        const blocked = surveys.find((survey) => survey.sync_blocked === 1)
        setStatus(
          `Sync conflict unresolved for ${blocked?.id ?? surveyId}. Use Retry now or Discard local change first.`,
        )
        return
      }
      if (blockReason === "already_submitted") {
        setStatus(`Survey ${surveyId} is already submitted`)
        return
      }
      if (blockReason === "not_synced") {
        setStatus(`Survey ${surveyId} must be synced before submit`)
        return
      }
      if (blockReason === "survey_blocked") {
        setStatus(
          `Survey ${surveyId} has unresolved sync conflict. Retry or discard local change first.`,
        )
        return
      }

      try {
        const draft = await getLocalSurveyDraft(surveyId)
        if (!draft) {
          setStatus(`Survey not found locally: ${surveyId}`)
          return
        }

        const readiness = evaluateSubmitReadinessFromDraft({
          region_version: draft.region_version,
          vegetation_stage: draft.vegetation_stage,
          factors: draft.factors,
          parcel_ids: draft.parcel_ids,
          expires_at: draft.expires_at,
        })

        if (!readiness.ready) {
          if (readiness.expired) {
            await markSurveyExpiredLocally(surveyId)
            await refreshLocalSurveys()
          }
          setStatus(formatSubmitReadinessError(surveyId, readiness))
          return
        }
      } catch (error) {
        setStatus(`Submit check error for ${surveyId}: ${(error as Error).message}`)
        return
      }

      try {
        const result = await withAuthRetry(async (token) => {
          const submitResult = await submitSurvey(apiUrl, token, surveyId)
          if (!submitResult.ok && isUnauthorizedResultMessage(submitResult.message)) {
            throw new Error(submitResult.message)
          }
          return submitResult
        })

        await refreshLocalSurveys()
        await refreshLocalAttachments()
        if (result.ok) {
          void handleLoadCanonicalDetails(surveyId, { silent: true })
        }
        if (result.ok && editingSurveyId === surveyId) {
          onStopEditing()
        }
        setStatus(
          result.ok ? `Submitted ${surveyId}` : `Submit blocked for ${surveyId}: ${result.message}`,
        )
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          setStatus("Login required before submit")
          return
        }
        setStatus(`Submit error for ${surveyId}: ${(error as Error).message}`)
      }
    },
    [
      apiUrl,
      clearSession,
      editingSurveyId,
      handleLoadCanonicalDetails,
      onStopEditing,
      refreshLocalAttachments,
      refreshLocalSurveys,
      setStatus,
      surveys,
      withAuthRetry,
    ],
  )

  const handleRetrySurvey = useCallback(
    async (surveyId: string): Promise<void> => {
      try {
        const result = await retrySurveyNow(surveyId)
        await refreshLocalSurveys()
        await refreshLocalAttachments()
        setStatus(`Retry queued for ${surveyId} (${result.queued} queue item(s))`)
      } catch (error) {
        setStatus(`Retry error: ${(error as Error).message}`)
      }
    },
    [refreshLocalAttachments, refreshLocalSurveys, setStatus],
  )

  const handleDiscardSurvey = useCallback(
    async (surveyId: string): Promise<void> => {
      try {
        const result = await discardSurveyLocalChanges(surveyId)
        await refreshLocalSurveys()
        await refreshLocalAttachments()
        setStatus(
          `Local changes discarded for ${surveyId} (${result.removed_queue} queue item(s) removed)`,
        )
      } catch (error) {
        setStatus(`Discard error: ${(error as Error).message}`)
      }
    },
    [refreshLocalAttachments, refreshLocalSurveys, setStatus],
  )

  const handleToggleVisibility = useCallback(
    async (surveyId: string, visibility: "private" | "public"): Promise<void> => {
      try {
        let result = await updateSurveyVisibility(apiUrl, accessToken, surveyId, visibility)
        if (!result.ok && isUnauthorizedResultMessage(result.message)) {
          const refreshed = await refreshSessionTokens()
          if (!refreshed?.accessToken) {
            await clearSession()
            setStatus("Login required before changing visibility")
            return
          }
          result = await updateSurveyVisibility(apiUrl, refreshed.accessToken, surveyId, visibility)
        }
        await refreshLocalSurveys()
        await refreshLocalAttachments()
        if (result.synced && (accessToken || refreshToken)) {
          void handleLoadCanonicalDetails(surveyId, { silent: true })
        }
        setStatus(
          result.ok
            ? result.message
            : `Visibility update warning for ${surveyId}: ${result.message}`,
        )
      } catch (error) {
        setStatus(`Visibility update error: ${(error as Error).message}`)
      }
    },
    [
      accessToken,
      apiUrl,
      clearSession,
      handleLoadCanonicalDetails,
      refreshLocalAttachments,
      refreshLocalSurveys,
      refreshSessionTokens,
      refreshToken,
      setStatus,
    ],
  )

  const confirmDeleteSurvey = useCallback(
    (surveyId: string): void => {
      Alert.alert(
        "Delete survey",
        "This will remove the survey locally and queue remote deletion.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              queueDeleteSurvey(surveyId)
                .then(async (result) => {
                  await refreshLocalSurveys()
                  await refreshLocalAttachments()
                  if (result.queued_delete && selectedSurveyId === surveyId) {
                    onCloseSurveyDetail()
                  }
                  setStatus(
                    result.queued_delete
                      ? `Deletion queued for ${surveyId}`
                      : `Survey not found: ${surveyId}`,
                  )
                  if (result.queued_delete) {
                    void maybeAutoSync("survey-delete-queued")
                  }
                })
                .catch((error) => setStatus(`Delete error: ${(error as Error).message}`))
            },
          },
        ],
      )
    },
    [
      maybeAutoSync,
      onCloseSurveyDetail,
      refreshLocalAttachments,
      refreshLocalSurveys,
      selectedSurveyId,
      setStatus,
    ],
  )

  const handleQueueAttachmentFromLibrary = useCallback(
    async (surveyId: string): Promise<void> => {
      const current = surveys.find((survey) => survey.id === surveyId)
      if (current?.status === "submitted") {
        setStatus(`Survey ${surveyId} is submitted and read-only`)
        return
      }

      try {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!permission.granted) {
          setStatus("Media library permission is required")
          return
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 0.8,
        })

        if (result.canceled || !result.assets?.[0]) {
          setStatus("No image selected")
          return
        }

        await queueAttachmentAsset(surveyId, result.assets[0], "library")
      } catch (error) {
        setStatus(`Attachment queue error: ${(error as Error).message}`)
      }
    },
    [queueAttachmentAsset, setStatus, surveys],
  )

  const handleQueueAttachmentFromCamera = useCallback(
    async (surveyId: string): Promise<void> => {
      const current = surveys.find((survey) => survey.id === surveyId)
      if (current?.status === "submitted") {
        setStatus(`Survey ${surveyId} is submitted and read-only`)
        return
      }

      try {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission.granted) {
          setStatus("Camera permission is required")
          return
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          quality: 0.8,
        })

        if (result.canceled || !result.assets?.[0]) {
          setStatus("No photo captured")
          return
        }

        await queueAttachmentAsset(surveyId, result.assets[0], "camera")
      } catch (error) {
        setStatus(`Attachment queue error: ${(error as Error).message}`)
      }
    },
    [queueAttachmentAsset, setStatus, surveys],
  )

  const handleDeleteAttachment = useCallback(
    async (surveyId: string, localAttachmentId: string): Promise<void> => {
      const current = surveys.find((survey) => survey.id === surveyId)
      if (current?.status === "submitted") {
        setStatus(`Survey ${surveyId} is submitted and read-only`)
        return
      }

      try {
        const result = await queueDeleteAttachment(surveyId, localAttachmentId)
        if (!result.removed_local) {
          setStatus(`Attachment not found locally: ${localAttachmentId}`)
          return
        }

        if (result.queued_delete) {
          try {
            const syncResult = await withAuthRetry((token) => syncPending(apiUrl, token))
            await refreshLocalSurveys()
            await refreshLocalAttachments()
            setStatus(
              `Attachment removed and synced: ${syncResult.synced} synced, ${syncResult.failed} failed, ${syncResult.pulled_surveys} surveys pulled, ${syncResult.pulled_attachments} attachments pulled`,
            )
            return
          } catch (error) {
            if ((error as Error).message === AUTH_REQUIRED_ERROR) {
              await refreshLocalSurveys()
              await refreshLocalAttachments()
              setStatus("Attachment removed locally. Login and sync to propagate server deletion.")
              return
            }
            await refreshLocalSurveys()
            await refreshLocalAttachments()
            setStatus(
              `Attachment removed locally; delete queued (sync pending: ${(error as Error).message})`,
            )
            return
          }
        }

        await refreshLocalSurveys()
        await refreshLocalAttachments()
        setStatus("Attachment removed locally")
      } catch (error) {
        setStatus(`Attachment delete error: ${(error as Error).message}`)
      }
    },
    [apiUrl, refreshLocalAttachments, refreshLocalSurveys, setStatus, surveys, withAuthRetry],
  )

  return {
    handleSubmitSurvey,
    handleRetrySurvey,
    handleDiscardSurvey,
    handleToggleVisibility,
    confirmDeleteSurvey,
    handleQueueAttachmentFromLibrary,
    handleQueueAttachmentFromCamera,
    handleDeleteAttachment,
  }
}
