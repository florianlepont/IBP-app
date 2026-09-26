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
import { deleteAttachmentFile } from "../../storage/attachment-files"
import { preparePhotoForStorage } from "../../storage/attachments"
import { isAuthRequiredError } from "../auth-errors"
import { assertSyncOwner, EnsureSyncOwner, isSyncOwnerMismatchError } from "./sync-owner-guard"
import { isSyncSuspendedError, SyncActivity } from "./sync-activity"
import { formatSubmitReadinessError, guessMimeType, isUnauthorizedResultMessage } from "./utils"

// D-04: these paths drain the whole sync_queue, so they honour the same owner
// gate as useSurveySyncNetwork — the change stays queued locally until then.
const OWNER_GATE_SUFFIX = "synchronisation en attente de la vérification du compte propriétaire"

type UseSurveySyncSurveyOperationsParams = {
  apiUrl: string
  accessToken: string
  selectedSurveyId: string | null
  editingSurveyId: string | null
  surveys: LocalSurvey[]
  clearSession: () => Promise<void>
  withAuthRetry: <T>(
    operation: (token: string, tokenSub: string | null) => Promise<T>,
  ) => Promise<T>
  refreshLocalSurveys: () => Promise<void>
  refreshLocalAttachments: () => Promise<void>
  onCloseSurveyDetail: () => void
  onStopEditing: () => void
  setStatus: (message: string) => void
  maybeAutoSync: (trigger: string) => Promise<void>
  handleLoadCanonicalDetails: (surveyId: string, options?: { silent?: boolean }) => Promise<void>
  syncAllowed: boolean
  ensureSyncOwner: EnsureSyncOwner
  syncActivity: SyncActivity
}

export function useSurveySyncSurveyOperations({
  apiUrl,
  accessToken,
  selectedSurveyId,
  editingSurveyId,
  surveys,
  clearSession,
  withAuthRetry,
  refreshLocalSurveys,
  refreshLocalAttachments,
  onCloseSurveyDetail,
  onStopEditing,
  setStatus,
  maybeAutoSync,
  handleLoadCanonicalDetails,
  syncAllowed,
  ensureSyncOwner,
  syncActivity,
}: UseSurveySyncSurveyOperationsParams) {
  // Drains the queue only after the execution-time owner check passed for the
  // exact token about to be used (CR-01 / WR-01).
  const runOwnerGuardedSync = useCallback(
    () =>
      withAuthRetry(async (token, tokenSub) => {
        await assertSyncOwner(ensureSyncOwner, tokenSub)
        return syncActivity.run(() => syncPending(apiUrl, token))
      }),
    [apiUrl, ensureSyncOwner, syncActivity, withAuthRetry],
  )

  const queueAttachmentAsset = useCallback(
    async (
      surveyId: string,
      asset: ImagePicker.ImagePickerAsset,
      source: "camera" | "library",
    ): Promise<void> => {
      const mimeType = asset.mimeType ?? guessMimeType(asset.uri)

      const prepared = await preparePhotoForStorage({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mimeType,
      })

      try {
        await queueLocalAttachment({
          survey_id: surveyId,
          local_uri: prepared.uri,
          mime_type: prepared.mimeType,
          size_bytes: prepared.sizeBytes,
          captured_at: new Date().toISOString(),
          metadata: {
            source,
            file_name: asset.fileName ?? null,
            width: prepared.width,
            height: prepared.height,
            original_width: asset.width ?? null,
            original_height: asset.height ?? null,
          },
        })
      } catch (error) {
        await deleteAttachmentFile(prepared.uri)
        throw error
      }

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

      if (!syncAllowed) {
        setStatus(`Submit postponed for ${surveyId}: ${OWNER_GATE_SUFFIX}`)
        return
      }

      try {
        const result = await withAuthRetry(async (token, tokenSub) => {
          await assertSyncOwner(ensureSyncOwner, tokenSub)
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
        if (isAuthRequiredError(error)) {
          await clearSession()
          setStatus("Login required before submit")
          return
        }
        if (isSyncOwnerMismatchError(error)) {
          setStatus(`Submit postponed for ${surveyId}: ${OWNER_GATE_SUFFIX}`)
          return
        }
        setStatus(`Submit error for ${surveyId}: ${(error as Error).message}`)
      }
    },
    [
      apiUrl,
      clearSession,
      editingSurveyId,
      ensureSyncOwner,
      handleLoadCanonicalDetails,
      onStopEditing,
      refreshLocalAttachments,
      refreshLocalSurveys,
      setStatus,
      surveys,
      syncAllowed,
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
        // An empty token makes updateSurveyVisibility queue the change without
        // draining the queue itself; the owner-guarded sync below sends it.
        const queued = await updateSurveyVisibility(apiUrl, "", surveyId, visibility)
        if (!queued.queued || !accessToken) {
          await refreshLocalSurveys()
          setStatus(queued.message)
          return
        }

        if (!syncAllowed) {
          await refreshLocalSurveys()
          setStatus(`Visibility queued locally (${visibility}); ${OWNER_GATE_SUFFIX}`)
          return
        }

        try {
          const result = await runOwnerGuardedSync()
          await refreshLocalSurveys()
          await refreshLocalAttachments()
          if (result.failed > 0) {
            setStatus(
              `Visibility update warning for ${surveyId}: Visibility queued locally, but sync reported ${result.failed} failed operation(s)`,
            )
            return
          }
          void handleLoadCanonicalDetails(surveyId, { silent: true })
          setStatus(`Visibility set to ${visibility} and synced`)
        } catch (error) {
          await refreshLocalSurveys()
          await refreshLocalAttachments()
          if (isAuthRequiredError(error)) {
            await clearSession()
            setStatus("Login required before changing visibility")
            return
          }
          if (isSyncOwnerMismatchError(error) || isSyncSuspendedError(error)) {
            setStatus(`Visibility queued locally (${visibility}); ${OWNER_GATE_SUFFIX}`)
            return
          }
          setStatus(
            `Visibility queued locally (${visibility}); sync pending (${(error as Error).message})`,
          )
        }
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
      runOwnerGuardedSync,
      setStatus,
      syncAllowed,
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

        if (result.queued_delete && !syncAllowed) {
          await refreshLocalSurveys()
          await refreshLocalAttachments()
          setStatus(`Attachment removed locally; delete queued (${OWNER_GATE_SUFFIX})`)
          return
        }

        if (result.queued_delete) {
          try {
            const syncResult = await runOwnerGuardedSync()
            await refreshLocalSurveys()
            await refreshLocalAttachments()
            setStatus(
              `Attachment removed and synced: ${syncResult.synced} synced, ${syncResult.failed} failed, ${syncResult.pulled_surveys} surveys pulled, ${syncResult.pulled_attachments} attachments pulled`,
            )
            return
          } catch (error) {
            if (isAuthRequiredError(error)) {
              await refreshLocalSurveys()
              await refreshLocalAttachments()
              setStatus("Attachment removed locally. Login and sync to propagate server deletion.")
              return
            }
            if (isSyncOwnerMismatchError(error) || isSyncSuspendedError(error)) {
              await refreshLocalSurveys()
              await refreshLocalAttachments()
              setStatus(`Attachment removed locally; delete queued (${OWNER_GATE_SUFFIX})`)
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
    [
      refreshLocalAttachments,
      refreshLocalSurveys,
      runOwnerGuardedSync,
      setStatus,
      surveys,
      syncAllowed,
    ],
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
