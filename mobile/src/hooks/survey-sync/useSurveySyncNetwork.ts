import { useCallback, useEffect, useRef } from "react"
import * as Network from "expo-network"
import { createSurveyReport } from "../../api/ibp-api"
import { hasPendingSyncWork, LocalSurvey, pullRemoteChanges, syncPending } from "../../storage"
import { isAuthRequiredError, isAuthTemporarilyUnavailableError } from "../auth-errors"
import { assertSyncOwner, EnsureSyncOwner, isSyncOwnerMismatchError } from "./sync-owner-guard"
import { isOnlineNetworkState } from "./utils"

const RETRY_LATER_MESSAGE =
  "Synchronisation reportée : authentification momentanément indisponible. Vos relevés locaux sont conservés."

// D-04: local data owned by another account suspends every automatic and
// manual sync/pull path until the conflict is resolved (owner-check status
// leaves "conflict" or turns "ok").
const OWNER_SUSPENDED_MESSAGE =
  "Synchronisation suspendue : des relevés locaux appartiennent à un autre compte."

// The execution-time owner check refused (the token's account, the session
// owner and the stored local-data owner disagree): nothing was sent.
const OWNER_RECHECK_MESSAGE =
  "Synchronisation reportée : vérification du compte propriétaire des données locales en cours."

type UseSurveySyncNetworkParams = {
  apiUrl: string
  accessToken: string | null
  surveys: LocalSurvey[]
  clearSession: () => Promise<void>
  withAuthRetry: <T>(fn: (token: string, tokenSub: string | null) => Promise<T>) => Promise<T>
  refreshLocalSurveys: () => Promise<void>
  refreshLocalAttachments: () => Promise<void>
  setStatus: (message: string) => void
  syncAllowed: boolean
  ensureSyncOwner: EnsureSyncOwner
}

export function useSurveySyncNetwork({
  apiUrl,
  accessToken,
  surveys,
  clearSession,
  withAuthRetry,
  refreshLocalSurveys,
  refreshLocalAttachments,
  setStatus,
  syncAllowed,
  ensureSyncOwner,
}: UseSurveySyncNetworkParams) {
  const syncInProgressRef = useRef(false)
  const pullInProgressRef = useRef(false)
  const lastOnlineStateRef = useRef<boolean | null>(null)
  const lastAutoSyncAtRef = useRef<number>(0)

  const runSync = useCallback(
    async (mode: "manual" | "auto", trigger?: string): Promise<void> => {
      if (!syncAllowed) {
        if (mode === "manual") {
          setStatus(OWNER_SUSPENDED_MESSAGE)
        }
        return
      }

      if (syncInProgressRef.current) {
        if (mode === "manual") {
          setStatus("Sync already in progress...")
        }
        return
      }

      syncInProgressRef.current = true
      try {
        if (mode === "manual") {
          setStatus("Sync in progress...")
        } else {
          setStatus(`Back online. Sync in progress${trigger ? ` (${trigger})` : ""}...`)
        }
        const result = await withAuthRetry(async (token, tokenSub) => {
          await assertSyncOwner(ensureSyncOwner, tokenSub)
          return syncPending(apiUrl, token)
        })
        await refreshLocalSurveys()
        await refreshLocalAttachments()
        setStatus(
          `Sync complete: ${result.synced} synced, ${result.failed} failed, ${result.pulled_surveys} surveys pulled, ${result.pulled_attachments} attachments pulled`,
        )
      } catch (error) {
        if (isSyncOwnerMismatchError(error)) {
          setStatus(OWNER_RECHECK_MESSAGE)
          return
        }
        if (isAuthTemporarilyUnavailableError(error)) {
          setStatus(RETRY_LATER_MESSAGE)
          return
        }
        if (isAuthRequiredError(error)) {
          await clearSession()
          setStatus(
            mode === "manual" ? "Login required before sync" : "Sync paused: login required",
          )
          return
        }
        setStatus(`Sync error: ${(error as Error).message}`)
      } finally {
        syncInProgressRef.current = false
      }
    },
    [
      apiUrl,
      clearSession,
      ensureSyncOwner,
      refreshLocalAttachments,
      refreshLocalSurveys,
      setStatus,
      syncAllowed,
      withAuthRetry,
    ],
  )

  const maybeAutoSync = useCallback(
    async (trigger: string): Promise<void> => {
      if (!syncAllowed) {
        return
      }
      if (lastOnlineStateRef.current !== true) {
        return
      }
      if (!accessToken) {
        return
      }

      const cooldownMs = 15_000
      const now = Date.now()
      if (now - lastAutoSyncAtRef.current < cooldownMs) {
        return
      }

      const hasWork = await hasPendingSyncWork()
      lastAutoSyncAtRef.current = now

      if (hasWork) {
        await runSync("auto", trigger)
        return
      }

      const shouldPullServerChanges =
        trigger === "startup" || trigger === "auth-ready" || trigger === "reconnected"
      if (!shouldPullServerChanges || pullInProgressRef.current || syncInProgressRef.current) {
        return
      }

      pullInProgressRef.current = true
      try {
        const result = await withAuthRetry(async (token, tokenSub) => {
          await assertSyncOwner(ensureSyncOwner, tokenSub)
          return pullRemoteChanges(apiUrl, token)
        })
        if (result.surveys > 0 || result.attachments > 0) {
          await refreshLocalSurveys()
          await refreshLocalAttachments()
          setStatus(
            `Server changes pulled: ${result.surveys} surveys, ${result.attachments} attachments`,
          )
        }
      } catch (error) {
        if (isSyncOwnerMismatchError(error)) {
          return
        }
        if (isAuthTemporarilyUnavailableError(error)) {
          setStatus(RETRY_LATER_MESSAGE)
          return
        }
        if (isAuthRequiredError(error)) {
          await clearSession()
          setStatus("Sync paused: login required")
          return
        }
      } finally {
        pullInProgressRef.current = false
      }
    },
    [
      accessToken,
      apiUrl,
      clearSession,
      ensureSyncOwner,
      refreshLocalAttachments,
      refreshLocalSurveys,
      runSync,
      setStatus,
      syncAllowed,
      withAuthRetry,
    ],
  )

  const handleSync = useCallback(async (): Promise<void> => {
    await runSync("manual")
  }, [runSync])

  const handlePullChanges = useCallback(async (): Promise<void> => {
    if (!syncAllowed) {
      setStatus(OWNER_SUSPENDED_MESSAGE)
      return
    }
    try {
      setStatus("Pulling server changes...")
      const result = await withAuthRetry(async (token, tokenSub) => {
        await assertSyncOwner(ensureSyncOwner, tokenSub)
        return pullRemoteChanges(apiUrl, token)
      })
      await refreshLocalSurveys()
      await refreshLocalAttachments()
      setStatus(
        `Pull complete: ${result.surveys} surveys, ${result.attachments} attachments, pages ${result.pages}`,
      )
    } catch (error) {
      if (isSyncOwnerMismatchError(error)) {
        setStatus(OWNER_RECHECK_MESSAGE)
        return
      }
      if (isAuthTemporarilyUnavailableError(error)) {
        setStatus(RETRY_LATER_MESSAGE)
        return
      }
      if (isAuthRequiredError(error)) {
        await clearSession()
        setStatus("Login required before pulling server changes")
        return
      }
      setStatus(`Pull error: ${(error as Error).message}`)
    }
  }, [
    apiUrl,
    clearSession,
    ensureSyncOwner,
    refreshLocalAttachments,
    refreshLocalSurveys,
    setStatus,
    syncAllowed,
    withAuthRetry,
  ])

  const handleReportSurvey = useCallback(
    async (surveyId: string, reason: string): Promise<{ ok: boolean; message: string }> => {
      const surveyIdTrimmed = surveyId.trim()
      const reasonTrimmed = reason.trim()
      if (!surveyIdTrimmed) {
        const message = "Survey id is required before reporting"
        setStatus(message)
        return { ok: false, message }
      }
      if (!reasonTrimmed) {
        const message = "Report reason is required"
        setStatus(message)
        return { ok: false, message }
      }

      try {
        await withAuthRetry((token) =>
          createSurveyReport(apiUrl, token, { survey_id: surveyIdTrimmed, reason: reasonTrimmed }),
        )
        const message = "Report sent to moderation"
        setStatus(message)
        return { ok: true, message }
      } catch (error) {
        if (isAuthTemporarilyUnavailableError(error)) {
          const message =
            "Signalement non envoyé : authentification momentanément indisponible. Réessayez plus tard."
          setStatus(message)
          return { ok: false, message }
        }
        if (isAuthRequiredError(error)) {
          await clearSession()
          const message = "Login required before reporting a survey"
          setStatus(message)
          return { ok: false, message }
        }
        const message = `Report error: ${(error as Error).message}`
        setStatus(message)
        return { ok: false, message }
      }
    },
    [apiUrl, clearSession, setStatus, withAuthRetry],
  )

  useEffect(() => {
    let mounted = true

    const handleNetworkState = (state: Network.NetworkState): void => {
      const online = isOnlineNetworkState(state)
      const wasOnline = lastOnlineStateRef.current
      lastOnlineStateRef.current = online

      if (online && wasOnline === false) {
        void maybeAutoSync("reconnected")
      }
    }

    void Network.getNetworkStateAsync()
      .then((state) => {
        if (!mounted) return
        handleNetworkState(state)
        if (isOnlineNetworkState(state)) {
          void maybeAutoSync("startup")
        }
      })
      .catch(() => undefined)

    const subscription = Network.addNetworkStateListener((state) => {
      if (!mounted) return
      handleNetworkState(state)
    })

    return () => {
      mounted = false
      subscription.remove()
    }
  }, [maybeAutoSync])

  useEffect(() => {
    if (!accessToken) {
      return
    }
    void maybeAutoSync("auth-ready")
  }, [accessToken, syncAllowed, maybeAutoSync])

  useEffect(() => {
    if (!accessToken) {
      return
    }

    const intervalId = setInterval(() => {
      void maybeAutoSync("heartbeat")
    }, 30_000)

    return () => {
      clearInterval(intervalId)
    }
  }, [accessToken, maybeAutoSync])

  useEffect(() => {
    if (!accessToken) {
      return
    }
    void maybeAutoSync("local-queue-updated")
  }, [surveys, accessToken, syncAllowed, maybeAutoSync])

  return {
    handleSync,
    handlePullChanges,
    handleReportSurvey,
    maybeAutoSync,
  }
}
