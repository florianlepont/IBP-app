import { useCallback, useEffect, useRef, useState } from "react"
import { Alert } from "react-native"
import { SurveyDetailResponse, SurveyDetailTab, SurveyEventItem } from "../app/types"
import { loadSurveyDetail, loadSurveyEvents, resetIbpData, resetUserData } from "../api/ibp-api"
import { clearLocalIbpData, LocalSurvey } from "../storage"
import { createInitialOperationStatus, updateOperationStatus } from "./operation-status"
import { AUTH_REQUIRED_ERROR, useAuthSession } from "./useAuthSession"
import { useSurveySyncNetwork } from "./survey-sync/useSurveySyncNetwork"
import { useSurveySyncProfile } from "./survey-sync/useSurveySyncProfile"
import { useSurveySyncSurveyOperations } from "./survey-sync/useSurveySyncSurveyOperations"

type UseSurveySyncParams = {
  apiUrl: string
  email: string
  password: string
  displayName: string
  surveys: LocalSurvey[]
  selectedSurveyId: string | null
  surveyDetailTab: SurveyDetailTab
  editingSurveyId: string | null
  refreshLocalSurveys: () => Promise<void>
  refreshLocalAttachments: () => Promise<void>
  onCloseSurveyDetail: () => void
  onStopEditing: () => void
}

export function useSurveySync({
  apiUrl,
  email,
  password,
  displayName,
  surveys,
  selectedSurveyId,
  surveyDetailTab,
  editingSurveyId,
  refreshLocalSurveys,
  refreshLocalAttachments,
  onCloseSurveyDetail,
  onStopEditing,
}: UseSurveySyncParams) {
  const [statusText, setStatusText] = useState<string>("Ready")
  const [operationStatus, setOperationStatus] = useState(createInitialOperationStatus("Ready"))
  const [surveyDetails, setSurveyDetails] = useState<Record<string, SurveyDetailResponse>>({})
  const [detailsLoadingSurveyId, setDetailsLoadingSurveyId] = useState<string | null>(null)
  const [surveyEvents, setSurveyEvents] = useState<Record<string, SurveyEventItem[]>>({})
  const [eventsLoadingSurveyId, setEventsLoadingSurveyId] = useState<string | null>(null)
  const detailAutoLoadCooldownUntilRef = useRef<Record<string, number>>({})

  const clearSurveySessionState = useCallback(async (): Promise<void> => {
    setSurveyDetails({})
    setSurveyEvents({})
    detailAutoLoadCooldownUntilRef.current = {}
    await clearLocalIbpData()
  }, [])

  const reportStatus = useCallback(
    (
      scope: "session" | "auth" | "profile" | "sync" | "survey" | "attachment" | "debug",
      state: "idle" | "running" | "success" | "error",
      message: string,
    ): void => {
      setStatusText(message)
      setOperationStatus((current) => updateOperationStatus(current, scope, state, message))
    },
    [],
  )

  const setStatus = useCallback(
    (message: string): void => {
      reportStatus("session", "idle", message)
    },
    [reportStatus],
  )

  const {
    accessToken,
    refreshToken,
    sessionRestoring,
    currentUser,
    profile,
    isAuthenticated,
    pendingEmailVerification,
    setProfileFromUser,
    clearSession,
    refreshSessionTokens,
    withAuthRetry,
    handleLoadMyProfile,
    handleLogin,
    handleRegister,
    handleLogout,
    handleVerifyEmail,
    handleResendVerification,
  } = useAuthSession({
    apiUrl,
    email,
    password,
    displayName,
    reportStatus,
    onSessionCleared: clearSurveySessionState,
  })

  const {
    profileUpdating,
    handleUpdateProfile,
    handleConfirmEmailChange,
    handlePickProfilePictureFromLibrary,
    handleTakeProfilePictureFromCamera,
    handleRemoveProfilePicture,
  } = useSurveySyncProfile({
    apiUrl,
    currentUser,
    setProfileFromUser,
    clearSession,
    withAuthRetry,
    handleLoadMyProfile,
    setStatus,
  })

  const { handleSync, handlePullChanges, handleReportSurvey, maybeAutoSync } = useSurveySyncNetwork(
    {
      apiUrl,
      accessToken,
      refreshToken,
      surveys,
      clearSession,
      withAuthRetry,
      refreshLocalSurveys,
      refreshLocalAttachments,
      setStatus,
    },
  )

  const handleDebugResetIbpData = async (): Promise<void> => {
    Alert.alert(
      "Debug reset IBP data",
      "This will delete all IBP surveys/events/attachments on server and clear local IBP data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setStatus("Debug reset IBP data in progress...")
                const result = await withAuthRetry((token) => resetIbpData(apiUrl, token))

                await clearLocalIbpData()
                await refreshLocalSurveys()
                await refreshLocalAttachments()
                setSurveyDetails({})
                setSurveyEvents({})
                onCloseSurveyDetail()
                if (editingSurveyId) {
                  onStopEditing()
                }
                setStatus(
                  `IBP data reset done: ${result.surveys_deleted ?? 0} surveys, ${result.attachments_deleted ?? 0} attachments, ${result.events_deleted ?? 0} events`,
                )
              } catch (error) {
                if ((error as Error).message === AUTH_REQUIRED_ERROR) {
                  await clearSession()
                  setStatus("Login required before debug reset")
                  return
                }
                setStatus(`Debug reset IBP error: ${(error as Error).message}`)
              }
            })()
          },
        },
      ],
    )
  }

  const handleDebugResetUserData = async (): Promise<void> => {
    Alert.alert(
      "Debug reset user data",
      "This will delete all users on server and clear your local session and IBP data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setStatus("Debug reset user data in progress...")
                const result = await withAuthRetry((token) => resetUserData(apiUrl, token))

                await clearLocalIbpData()
                onCloseSurveyDetail()
                if (editingSurveyId) {
                  onStopEditing()
                }
                await clearSession()
                await refreshLocalSurveys()
                await refreshLocalAttachments()
                setStatus(
                  `User data reset done: ${result.users_deleted ?? 0} users, ${result.surveys_deleted ?? 0} surveys, ${result.attachments_deleted ?? 0} attachments`,
                )
              } catch (error) {
                if ((error as Error).message === AUTH_REQUIRED_ERROR) {
                  await clearSession()
                  setStatus("Login required before debug reset")
                  return
                }
                setStatus(`Debug reset user error: ${(error as Error).message}`)
              }
            })()
          },
        },
      ],
    )
  }
  const handleLoadCanonicalDetails = useCallback(
    async (surveyId: string, options?: { silent?: boolean }): Promise<void> => {
      const silent = options?.silent ?? false

      try {
        setDetailsLoadingSurveyId(surveyId)
        if (!silent) {
          setStatus(`Loading canonical details for ${surveyId}...`)
        }
        const payload = await withAuthRetry((token) => loadSurveyDetail(apiUrl, token, surveyId))

        setSurveyDetails((previous) => ({ ...previous, [surveyId]: payload }))
        if (detailAutoLoadCooldownUntilRef.current[surveyId]) {
          delete detailAutoLoadCooldownUntilRef.current[surveyId]
        }
        if (!silent) {
          setStatus(`Canonical details loaded for ${surveyId}`)
        }
      } catch (error) {
        // Prevent endless request loops on non-fetchable surveys (local-only or server errors).
        detailAutoLoadCooldownUntilRef.current[surveyId] = Date.now() + 60_000
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          if (!silent) {
            setStatus("Login required before loading canonical details")
          }
          return
        }
        if (!silent) {
          setStatus(`Load detail error: ${(error as Error).message}`)
        }
      } finally {
        setDetailsLoadingSurveyId((current) => (current === surveyId ? null : current))
      }
    },
    [apiUrl, clearSession, setStatus, withAuthRetry],
  )

  const handleLoadSurveyEvents = useCallback(
    async (surveyId: string, options?: { silent?: boolean }): Promise<void> => {
      const silent = options?.silent ?? false

      try {
        setEventsLoadingSurveyId(surveyId)
        if (!silent) {
          setStatus(`Loading events for ${surveyId}...`)
        }
        const payload = await withAuthRetry((token) => loadSurveyEvents(apiUrl, token, surveyId))

        setSurveyEvents((previous) => ({ ...previous, [surveyId]: payload.items ?? [] }))
        if (!silent) {
          setStatus(`Events loaded for ${surveyId}`)
        }
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          if (!silent) {
            setStatus("Login required before loading survey events")
          }
          return
        }
        if (!silent) {
          setStatus(`Load events error: ${(error as Error).message}`)
        }
      } finally {
        setEventsLoadingSurveyId((current) => (current === surveyId ? null : current))
      }
    },
    [apiUrl, clearSession, setStatus, withAuthRetry],
  )

  const {
    handleSubmitSurvey,
    handleRetrySurvey,
    handleDiscardSurvey,
    handleToggleVisibility,
    confirmDeleteSurvey,
    handleQueueAttachmentFromLibrary,
    handleQueueAttachmentFromCamera,
    handleDeleteAttachment,
  } = useSurveySyncSurveyOperations({
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
  })

  useEffect(() => {
    if (!selectedSurveyId || !accessToken) {
      return
    }
    const selectedSurvey = surveys.find((survey) => survey.id === selectedSurveyId)
    if (!selectedSurvey) {
      return
    }
    if (
      selectedSurvey.status !== "submitted" &&
      selectedSurvey.status !== "expired" &&
      selectedSurvey.sync_state !== "synced"
    ) {
      return
    }
    if (surveyDetails[selectedSurveyId]) {
      return
    }
    if (detailsLoadingSurveyId === selectedSurveyId) {
      return
    }
    const cooldownUntil = detailAutoLoadCooldownUntilRef.current[selectedSurveyId] ?? 0
    if (cooldownUntil > Date.now()) {
      return
    }
    void handleLoadCanonicalDetails(selectedSurveyId, { silent: true })
  }, [selectedSurveyId, accessToken, surveys, surveyDetails, detailsLoadingSurveyId])

  useEffect(() => {
    if (!selectedSurveyId || !accessToken) {
      return
    }
    if (surveyDetailTab !== "events") {
      return
    }
    if (surveyEvents[selectedSurveyId]) {
      return
    }
    if (eventsLoadingSurveyId === selectedSurveyId) {
      return
    }
    void handleLoadSurveyEvents(selectedSurveyId, { silent: true })
  }, [selectedSurveyId, accessToken, surveyDetailTab, surveyEvents, eventsLoadingSurveyId])

  return {
    accessToken,
    sessionRestoring,
    isAuthenticated,
    pendingEmailVerification,
    currentUser,
    profile,
    profileUpdating,
    status: statusText,
    operationStatus,
    setStatus,
    surveyDetails,
    detailsLoadingSurveyId,
    surveyEvents,
    eventsLoadingSurveyId,
    handleLogin,
    handleRegister,
    handleLogout,
    handleVerifyEmail,
    handleResendVerification,
    handleLoadMyProfile,
    handleUpdateProfile,
    handleConfirmEmailChange,
    handlePickProfilePictureFromLibrary,
    handleTakeProfilePictureFromCamera,
    handleRemoveProfilePicture,
    handleSync,
    handlePullChanges,
    handleReportSurvey,
    handleDebugResetIbpData,
    handleDebugResetUserData,
    handleSubmitSurvey,
    handleRetrySurvey,
    handleDiscardSurvey,
    handleToggleVisibility,
    confirmDeleteSurvey,
    handleQueueAttachmentFromLibrary,
    handleQueueAttachmentFromCamera,
    handleDeleteAttachment,
    handleLoadCanonicalDetails,
    handleLoadSurveyEvents,
  }
}
