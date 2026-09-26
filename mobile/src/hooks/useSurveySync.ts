import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert } from "react-native"
import { SurveyDetailResponse, SurveyDetailTab, SurveyEventItem } from "../app/types"
import { formatUnsyncedWorkSummary, hasUnsyncedWork } from "../app/local-data-owner"
import {
  deleteMyAccount,
  loadSurveyDetail,
  loadSurveyEvents,
  resetIbpData,
  resetUserData,
} from "../api/ibp-api"
import { clearLocalIbpData } from "../storage/surveys"
import { countUnsyncedLocalWork } from "../storage/local-owner"
import type { LocalSurvey } from "../storage/types"
import { createInitialOperationStatus, updateOperationStatus } from "./operation-status"
import { AUTH_REQUIRED_ERROR, useAuth0Session } from "./useAuth0Session"
import { useLocalDataOwner } from "./useLocalDataOwner"
import {
  createSyncActivity,
  purgeWhileSyncSuspended,
  SyncActivity,
} from "./survey-sync/sync-activity"
import { useAttachmentPreviews } from "./survey-sync/useAttachmentPreviews"
import { useSurveySyncNetwork } from "./survey-sync/useSurveySyncNetwork"
import { useSurveySyncProfile } from "./survey-sync/useSurveySyncProfile"
import { useSurveySyncSurveyOperations } from "./survey-sync/useSurveySyncSurveyOperations"
import { useStableActions } from "../state/useLatestCallback"

type UseSurveySyncParams = {
  apiUrl: string
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
  // Internal only: no consumer reads it (RESEARCH Pattern 1).
  const [, setOperationStatus] = useState(createInitialOperationStatus("Ready"))
  const [surveyDetails, setSurveyDetails] = useState<Record<string, SurveyDetailResponse>>({})
  const [detailsLoadingSurveyId, setDetailsLoadingSurveyId] = useState<string | null>(null)
  const [surveyEvents, setSurveyEvents] = useState<Record<string, SurveyEventItem[]>>({})
  const [eventsLoadingSurveyId, setEventsLoadingSurveyId] = useState<string | null>(null)
  const detailAutoLoadCooldownUntilRef = useRef<Record<string, number>>({})
  // WR-08: every sync/pull runs through this tracker so a purge can wait for
  // in-flight writes and block new ones.
  const syncActivityRef = useRef<SyncActivity | null>(null)
  if (!syncActivityRef.current) {
    syncActivityRef.current = createSyncActivity()
  }
  const syncActivity = syncActivityRef.current

  // Session end resets UI state only — local surveys, queue and photos are
  // never purged here (D-02, audit M-C1).
  const clearSurveySessionState = useCallback(async (): Promise<void> => {
    setSurveyDetails({})
    setSurveyEvents({})
    detailAutoLoadCooldownUntilRef.current = {}
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

  const resetLocalSurveyState = useCallback(async (): Promise<void> => {
    await purgeWhileSyncSuspended(syncActivity, clearLocalIbpData)
    await refreshLocalSurveys()
    await refreshLocalAttachments()
    setSurveyDetails({})
    setSurveyEvents({})
    onCloseSurveyDetail()
    if (editingSurveyId) {
      onStopEditing()
    }
  }, [
    editingSurveyId,
    onCloseSurveyDetail,
    onStopEditing,
    refreshLocalAttachments,
    refreshLocalSurveys,
    syncActivity,
  ])

  const {
    accessToken,
    sessionRestoring,
    currentUser,
    profile,
    sessionOwner,
    isAuthenticated,
    setProfileFromUser,
    clearSession,
    withAuthRetry,
    handleLoadMyProfile,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleLogout: handleAuthLogout,
  } = useAuth0Session({
    apiUrl,
    reportStatus,
    onSessionCleared: clearSurveySessionState,
  })

  // D-04: local data owned by another account suspends sync until the user
  // resolves the conflict (log back in with the owning account, or delete).
  const onLocalDataPurged = useCallback(async (): Promise<void> => {
    await refreshLocalSurveys()
    await refreshLocalAttachments()
    setSurveyDetails({})
    setSurveyEvents({})
  }, [refreshLocalAttachments, refreshLocalSurveys])

  const localDataOwner = useLocalDataOwner({ sessionOwner, onLocalDataPurged, syncActivity })

  // D-03: logout with unsynced work purges local data only after the user
  // explicitly confirms, having seen how many surveys/photos will be lost.
  // WR-08: sync is suspended first, then the purge waits for any sync still
  // writing the previous account's data, so no pulled row can land after it
  // (it would carry no owner marker and be adopted by the next account).
  const performLogoutAndPurge = useCallback(async (): Promise<void> => {
    const resumeSync = syncActivity.suspend()
    try {
      await handleAuthLogout()
      await syncActivity.waitForIdle()
      await clearLocalIbpData()
      await refreshLocalSurveys()
      await refreshLocalAttachments()
      setStatus("Déconnecté")
    } catch (error) {
      setStatus(`Erreur de déconnexion : ${(error as Error).message}`)
    } finally {
      resumeSync()
    }
  }, [handleAuthLogout, refreshLocalAttachments, refreshLocalSurveys, setStatus, syncActivity])

  const handleLogout = useCallback(async (): Promise<void> => {
    const work = await countUnsyncedLocalWork()
    if (hasUnsyncedWork(work)) {
      Alert.alert(
        "Données non synchronisées",
        `Non synchronisé : ${formatUnsyncedWorkSummary(work)}. Si vous vous déconnectez maintenant, ces données seront définitivement supprimées de cet appareil.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Supprimer et se déconnecter",
            style: "destructive",
            onPress: () => {
              void performLogoutAndPurge()
            },
          },
        ],
      )
      return
    }

    await performLogoutAndPurge()
  }, [performLogoutAndPurge])

  const handleSwitchToOwnerAccount = useCallback(async (): Promise<void> => {
    // Local data and the owner marker stay untouched — logging back in with
    // the owning account will resolve to "match" and resume sync.
    await handleAuthLogout()
  }, [handleAuthLogout])

  const handleDiscardForeignData = useCallback((): void => {
    Alert.alert(
      "Supprimer les données de l'autre compte ?",
      `${formatUnsyncedWorkSummary(localDataOwner.foreignWork)} seront définitivement supprimés de cet appareil. Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            void localDataOwner.discardForeignData()
          },
        },
      ],
    )
  }, [localDataOwner])

  const {
    profileUpdating,
    handleUpdateProfile,
    handleChangeEmail,
    handlePasswordReset,
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

  const performDeleteAccount = useCallback(async (): Promise<void> => {
    try {
      setStatus("Deleting account...")
      await withAuthRetry((token) => deleteMyAccount(apiUrl, token))
      // The account no longer exists on the server, so the data can never
      // sync — purge without the unsynced-work alert (the delete dialog
      // already warned this action is irreversible).
      await performLogoutAndPurge()
    } catch (error) {
      if ((error as Error).message === AUTH_REQUIRED_ERROR) {
        await clearSession()
        setStatus("Login required before deleting account")
        return
      }

      const message = (error as Error).message
      setStatus(`Delete account error: ${message}`)
      Alert.alert("Delete account failed", `The account has not been deleted. ${message}`, [
        { text: "OK" },
      ])
    }
  }, [apiUrl, clearSession, performLogoutAndPurge, setStatus, withAuthRetry])

  const handleDeleteAccount = useCallback(async (): Promise<void> => {
    Alert.alert(
      "Delete account",
      "This action is immediate and irreversible. Your name, email, and profile photo will be permanently deleted. Previously submitted surveys will be anonymised and retained for scientific purposes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete my account",
          style: "destructive",
          onPress: () => {
            void performDeleteAccount()
          },
        },
      ],
    )
  }, [performDeleteAccount])

  const { handleSync, handlePullChanges, handleReportSurvey, maybeAutoSync } = useSurveySyncNetwork(
    {
      apiUrl,
      accessToken,
      surveys,
      clearSession,
      withAuthRetry,
      refreshLocalSurveys,
      refreshLocalAttachments,
      setStatus,
      syncAllowed: localDataOwner.syncAllowed,
      ensureSyncOwner: localDataOwner.ensureSyncOwner,
      ownerStatus: localDataOwner.status,
      recheckOwner: localDataOwner.recheck,
      syncActivity,
    },
  )

  const { handleEnsureAttachmentPreviews, handleSimulateMissingAttachmentFile } =
    useAttachmentPreviews({
      apiUrl,
      withAuthRetry,
      syncActivity,
      syncAllowed: localDataOwner.syncAllowed,
      refreshLocalAttachments,
    })

  const runDebugReset = useCallback(
    ({
      title,
      message,
      inProgressMessage,
      onReset,
    }: {
      title: string
      message: string
      inProgressMessage: string
      onReset: () => Promise<string>
    }): void => {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setStatus(inProgressMessage)
                const successMessage = await onReset()
                setStatus(successMessage)
              } catch (error) {
                if ((error as Error).message === AUTH_REQUIRED_ERROR) {
                  await clearSession()
                  setStatus("Login required before debug reset")
                  return
                }

                setStatus(`${title} error: ${(error as Error).message}`)
              }
            })()
          },
        },
      ])
    },
    [clearSession, setStatus],
  )

  const handleDebugResetIbpData = useCallback(async (): Promise<void> => {
    runDebugReset({
      title: "Debug reset IBP data",
      message:
        "This will delete all IBP surveys/events/attachments on server and clear local IBP data.",
      inProgressMessage: "Debug reset IBP data in progress...",
      onReset: async () => {
        const result = await withAuthRetry((token) => resetIbpData(apiUrl, token))
        await resetLocalSurveyState()
        return `IBP data reset done: ${result.surveys_deleted ?? 0} surveys, ${result.attachments_deleted ?? 0} attachments, ${result.events_deleted ?? 0} events`
      },
    })
  }, [apiUrl, resetLocalSurveyState, runDebugReset, withAuthRetry])

  const handleDebugResetUserData = useCallback(async (): Promise<void> => {
    runDebugReset({
      title: "Debug reset user data",
      message: "This will delete all users on server and clear your local session and IBP data.",
      inProgressMessage: "Debug reset user data in progress...",
      onReset: async () => {
        const result = await withAuthRetry((token) => resetUserData(apiUrl, token))
        await resetLocalSurveyState()
        await clearSession()
        return `User data reset done: ${result.users_deleted ?? 0} users, ${result.surveys_deleted ?? 0} surveys, ${result.attachments_deleted ?? 0} attachments`
      },
    })
  }, [apiUrl, clearSession, resetLocalSurveyState, runDebugReset, withAuthRetry])
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
    syncAllowed: localDataOwner.syncAllowed,
    ensureSyncOwner: localDataOwner.ensureSyncOwner,
    syncActivity,
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
  }, [
    selectedSurveyId,
    accessToken,
    surveys,
    surveyDetails,
    detailsLoadingSurveyId,
    handleLoadCanonicalDetails,
  ])

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
  }, [
    selectedSurveyId,
    accessToken,
    surveyDetailTab,
    surveyEvents,
    eventsLoadingSurveyId,
    handleLoadSurveyEvents,
  ])

  // D-01 / criterion 1: memoised slices instead of a new literal every render.
  // Each action slice is created once (useStableActions) and forwards to the
  // latest handler, so its identity never changes.
  const localDataOwnerStatus = localDataOwner.status
  const foreignWork = localDataOwner.foreignWork
  const foreignOwnerEmail = localDataOwner.foreignOwnerEmail
  const sessionState = useMemo(
    () => ({
      sessionRestoring,
      isAuthenticated,
      currentUser,
      profile,
      profileUpdating,
      localDataOwnerStatus,
      foreignWork,
      foreignOwnerEmail,
    }),
    [
      sessionRestoring,
      isAuthenticated,
      currentUser,
      profile,
      profileUpdating,
      localDataOwnerStatus,
      foreignWork,
      foreignOwnerEmail,
    ],
  )

  const sessionActions = useStableActions({
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleLogout,
    handleLoadMyProfile,
    handleUpdateProfile,
    handleChangeEmail,
    handlePasswordReset,
    handleDeleteAccount,
    handlePickProfilePictureFromLibrary,
    handleTakeProfilePictureFromCamera,
    handleRemoveProfilePicture,
    handleSwitchToOwnerAccount,
    handleDiscardForeignData,
  })

  const syncActions = useStableActions({
    setStatus,
    handleSync,
    handlePullChanges,
    handleReportSurvey,
    handleDebugResetIbpData,
    handleDebugResetUserData,
    handleEnsureAttachmentPreviews,
    handleSimulateMissingAttachmentFile,
  })

  const surveyOperations = useStableActions({
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
  })

  const surveyDetailsState = useMemo(
    () => ({ surveyDetails, detailsLoadingSurveyId, surveyEvents, eventsLoadingSurveyId }),
    [surveyDetails, detailsLoadingSurveyId, surveyEvents, eventsLoadingSurveyId],
  )

  return useMemo(
    () => ({
      // Flat view of the stable session and sync actions, kept for the 01.5
      // invariant suites (useSurveySync.logout-purge.test.ts reads
      // handleLogout/handleSync at the top level and must stay unchanged).
      // New code reads the slices.
      ...sessionActions,
      ...syncActions,
      sessionState,
      sessionActions,
      accessToken,
      status: statusText,
      syncActions,
      surveyOperations,
      surveyDetailsState,
    }),
    [
      sessionState,
      sessionActions,
      accessToken,
      statusText,
      syncActions,
      surveyOperations,
      surveyDetailsState,
    ],
  )
}
