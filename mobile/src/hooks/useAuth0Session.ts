import { useCallback, useEffect, useRef, useState } from "react"
import * as Network from "expo-network"
import Auth0 from "react-native-auth0"
import { ApiError } from "../api/client"
import { getMyProfile } from "../api/ibp-api"
import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_DOMAIN,
  buildApiTokenRejectedMessage,
  buildAuth0UnauthorizedMessage,
} from "../app/auth0-config"
import { extractIdTokenClaims, IdTokenClaims } from "../app/id-token"
import { fr, logStatusDetail } from "../i18n"
import { AuthUser } from "../app/types"
import { clearCachedProfile, loadCachedProfile, saveCachedProfile } from "../storage/profile-cache"
import {
  AUTH_REQUIRED_ERROR,
  AUTH_TEMPORARILY_UNAVAILABLE_ERROR,
  classifyCredentialsError,
  EMAIL_ALREADY_LINKED_MESSAGE,
  isEmailAlreadyLinkedError,
} from "./auth-errors"
import { OperationScope, OperationState } from "./operation-status"
import { isOnlineNetworkState } from "./survey-sync/utils"

export { AUTH_REQUIRED_ERROR, AUTH_TEMPORARILY_UNAVAILABLE_ERROR } from "./auth-errors"

const text = fr.status.session

// D-13: while the profile comes from the cache, retry GET /me when the
// network comes back online and periodically while online, until it
// succeeds once and stops (T-01.5-14: never hammer /me).
const PROFILE_REFRESH_INTERVAL_MS = 60_000

function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 401
  if (error instanceof Error) return /401|unauthorized|auth_required/i.test(error.message)
  return false
}

// Any exception here means "unknown" — treat it as offline, the safe side:
// a genuine session-ending error (e.g. RENEW_FAILED) is retried later rather
// than incorrectly ending the session (D-01a).
async function isDeviceOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync()
    return isOnlineNetworkState(state)
  } catch {
    return false
  }
}

function extractLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  if (error && typeof error === "object") {
    const candidate = error as { description?: unknown; details?: unknown; message?: unknown }
    if (typeof candidate.description === "string" && candidate.description.trim().length > 0) {
      return candidate.description
    }
    if (typeof candidate.details === "string" && candidate.details.trim().length > 0) {
      return candidate.details
    }
    if (typeof candidate.message === "string" && candidate.message.trim().length > 0) {
      return candidate.message
    }
  }

  return "Unknown login error"
}

type UseAuth0SessionParams = {
  apiUrl: string
  reportStatus: (scope: OperationScope, state: OperationState, message: string) => void
  onSessionCleared?: () => void | Promise<void>
}

export function useAuth0Session({ apiUrl, reportStatus, onSessionCleared }: UseAuth0SessionParams) {
  const [accessToken, setAccessToken] = useState("")
  const [sessionRestoring, setSessionRestoring] = useState(true)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState("Not logged in")
  const [sessionOwner, setSessionOwner] = useState<IdTokenClaims | null>(null)
  const [profileFromCache, setProfileFromCache] = useState(false)
  const auth0Ref = useRef<Auth0 | null>(null)
  const profileRefreshInFlightRef = useRef(false)

  const apiUrlRef = useRef(apiUrl)
  apiUrlRef.current = apiUrl

  const getAuth0 = useCallback((): Auth0 => {
    if (!auth0Ref.current) {
      auth0Ref.current = new Auth0({ domain: AUTH0_DOMAIN, clientId: AUTH0_CLIENT_ID })
    }

    return auth0Ref.current
  }, [])

  const setProfileFromUser = useCallback((user: AuthUser): void => {
    setCurrentUser(user)
    setProfile(`${user.display_name} (${user.email})`)
  }, [])

  const clearSession = useCallback(async (): Promise<void> => {
    setAccessToken("")
    setSessionRestoring(false)
    setCurrentUser(null)
    setProfile("Not logged in")
    setSessionOwner(null)
    setProfileFromCache(false)
    void clearCachedProfile()
    await onSessionCleared?.()
  }, [onSessionCleared])

  // WR-04: the API refused to provision this identity (its email belongs to
  // another account). Drop the stored credentials so no heartbeat keeps
  // calling the API with them, and tell the user why.
  const endRefusedSession = useCallback(async (): Promise<string> => {
    await getAuth0()
      .credentialsManager.clearCredentials()
      .catch(() => undefined)
    await clearSession()
    reportStatus("auth", "error", EMAIL_ALREADY_LINKED_MESSAGE)
    return EMAIL_ALREADY_LINKED_MESSAGE
  }, [clearSession, getAuth0, reportStatus])

  // Never returns null and never calls clearSession: a network/timeout/unknown
  // error means "retry later", only a genuine refresh-token rejection ends the
  // session (thrown as AUTH_REQUIRED, handled by the caller).
  // Also returns the `sub` of the account the token belongs to, so D-04 sync
  // paths can check it against the local-data owner right before sending.
  const getValidCredentials = useCallback(
    async (options?: {
      forceRefresh?: boolean
    }): Promise<{ accessToken: string; sub: string | null }> => {
      const forceRefresh = options?.forceRefresh ?? false

      let credentials
      try {
        const credentialsManager = getAuth0().credentialsManager
        credentials = forceRefresh
          ? await credentialsManager.getCredentials(undefined, undefined, undefined, true)
          : await credentialsManager.getCredentials()
      } catch (error) {
        const kind = classifyCredentialsError(error, {
          phase: "refresh",
          isOnline: await isDeviceOnline(),
        })
        throw new Error(
          kind === "session-ended" ? AUTH_REQUIRED_ERROR : AUTH_TEMPORARILY_UNAVAILABLE_ERROR,
        )
      }

      if (!credentials?.accessToken) {
        throw new Error(AUTH_TEMPORARILY_UNAVAILABLE_ERROR)
      }

      const claims = extractIdTokenClaims(credentials.idToken)
      setAccessToken(credentials.accessToken)
      setSessionOwner(claims)
      return { accessToken: credentials.accessToken, sub: claims?.sub ?? null }
    },
    [getAuth0],
  )

  const getValidAccessToken = useCallback(
    async (options?: { forceRefresh?: boolean }): Promise<string> =>
      (await getValidCredentials(options)).accessToken,
    [getValidCredentials],
  )

  // `operation` receives the token and the `sub` of the account it belongs to.
  const withAuthRetry = useCallback(
    async <T>(operation: (token: string, tokenSub: string | null) => Promise<T>): Promise<T> => {
      const credentials = await getValidCredentials()

      try {
        return await operation(credentials.accessToken, credentials.sub)
      } catch (error) {
        if (!isUnauthorizedError(error)) throw error

        // Force a fresh token on 401 instead of reusing the (still-cached) one.
        const refreshed = await getValidCredentials({ forceRefresh: true })
        return operation(refreshed.accessToken, refreshed.sub)
      }
    },
    [getValidCredentials],
  )

  const handleLoadMyProfile = useCallback(
    async (options?: { silent?: boolean }): Promise<AuthUser | null> => {
      const silent = options?.silent ?? false
      try {
        let tokenSubForCache: string | null = null
        const user = await withAuthRetry((token, tokenSub) => {
          tokenSubForCache = tokenSub
          return getMyProfile(apiUrl, token)
        })
        setProfileFromUser(user)
        setProfileFromCache(false)
        if (tokenSubForCache) void saveCachedProfile(tokenSubForCache, user)
        if (!silent) reportStatus("profile", "success", text.profileLoaded())
        return user
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          if (!silent) reportStatus("profile", "error", text.profileLoginRequired())
          return null
        }
        logStatusDetail("session.loadProfile", error)
        if (!silent) reportStatus("profile", "error", text.profileLoadFailed())
        return null
      }
    },
    [apiUrl, clearSession, reportStatus, setProfileFromUser, withAuthRetry],
  )

  // Restore session on app launch
  useEffect(() => {
    let active = true

    const restore = async (): Promise<void> => {
      try {
        if (active) setSessionRestoring(true)
        const auth0 = getAuth0()
        const hasCredentials = await auth0.credentialsManager.hasValidCredentials()
        if (!hasCredentials) {
          if (active) {
            reportStatus("session", "idle", text.ready())
            setSessionRestoring(false)
          }
          return
        }

        const credentials = await auth0.credentialsManager.getCredentials()
        if (!credentials?.accessToken || !active) {
          if (active) setSessionRestoring(false)
          return
        }

        setAccessToken(credentials.accessToken)
        const sessionOwner = extractIdTokenClaims(credentials.idToken)
        setSessionOwner(sessionOwner)

        const user = await getMyProfile(apiUrlRef.current, credentials.accessToken).catch(
          () => null,
        )
        if (!active) return

        if (!user) {
          const cached = sessionOwner?.sub ? await loadCachedProfile(sessionOwner.sub) : null
          if (!active) return

          if (cached) {
            setProfileFromUser(cached)
            setProfileFromCache(true)
            reportStatus("session", "success", text.restoredOfflineCached())
            setSessionRestoring(false)
            return
          }

          reportStatus("session", "success", text.restoredOffline())
          setSessionRestoring(false)
          return
        }

        setProfileFromUser(user)
        setProfileFromCache(false)
        if (sessionOwner?.sub) void saveCachedProfile(sessionOwner.sub, user)
        reportStatus("session", "success", text.restored())
        setSessionRestoring(false)
      } catch (error) {
        if (!active) return

        const kind = classifyCredentialsError(error, {
          phase: "restore",
          isOnline: await isDeviceOnline(),
        })

        if (kind === "session-ended") {
          await clearSession().catch(() => undefined)
          reportStatus("session", "error", text.restoreExpired())
        } else {
          reportStatus("session", "idle", text.restoreUnavailable())
        }
        setSessionRestoring(false)
      }
    }

    void restore()
    return () => {
      active = false
    }
  }, [clearSession, getAuth0, reportStatus, setProfileFromUser])

  const handleLogin = useCallback(async (): Promise<string | null> => {
    try {
      reportStatus("auth", "running", text.loggingIn())
      const auth0 = getAuth0()
      const credentials = await auth0.webAuth.authorize({
        scope: "openid profile email offline_access",
        audience: AUTH0_AUDIENCE,
      })

      await auth0.credentialsManager.saveCredentials(credentials)
      setAccessToken(credentials.accessToken)
      const claims = extractIdTokenClaims(credentials.idToken)
      setSessionOwner(claims)

      let user: AuthUser
      try {
        user = await getMyProfile(apiUrl, credentials.accessToken)
      } catch (error) {
        if (isEmailAlreadyLinkedError(error)) {
          return await endRefusedSession()
        }
        if (error instanceof ApiError && error.status === 401) {
          const msg = buildApiTokenRejectedMessage(apiUrl)
          reportStatus("auth", "error", msg)
          return msg
        }
        throw error
      }

      setProfileFromUser(user)
      setProfileFromCache(false)
      if (claims?.sub) void saveCachedProfile(claims.sub, user)
      reportStatus("auth", "success", text.loggedIn())
      return null
    } catch (error) {
      const message = extractLoginErrorMessage(error)
      // User cancelled the login flow
      if (message.includes("a0.session.user_cancelled") || message.includes("USER_CANCELLED")) {
        reportStatus("auth", "idle", "")
        return null
      }
      if (/unauthorized/i.test(message)) {
        const msg = buildAuth0UnauthorizedMessage(apiUrl)
        reportStatus("auth", "error", msg)
        return msg
      }
      logStatusDetail("session.login", error)
      const msg = text.loginFailed()
      reportStatus("auth", "error", msg)
      return msg
    }
  }, [apiUrl, endRefusedSession, getAuth0, reportStatus, setProfileFromUser])

  const handleRegister = useCallback(async (): Promise<string | null> => {
    try {
      reportStatus("auth", "running", text.loggingIn())
      const auth0 = getAuth0()
      const credentials = await auth0.webAuth.authorize({
        scope: "openid profile email offline_access",
        audience: AUTH0_AUDIENCE,
        additionalParameters: { screen_hint: "signup" },
      })

      await auth0.credentialsManager.saveCredentials(credentials)
      setAccessToken(credentials.accessToken)
      const claims = extractIdTokenClaims(credentials.idToken)
      setSessionOwner(claims)

      let user: AuthUser
      try {
        user = await getMyProfile(apiUrl, credentials.accessToken)
      } catch (error) {
        if (isEmailAlreadyLinkedError(error)) {
          return await endRefusedSession()
        }
        if (error instanceof ApiError && error.status === 401) {
          const msg = buildApiTokenRejectedMessage(apiUrl)
          reportStatus("auth", "error", msg)
          return msg
        }
        throw error
      }

      setProfileFromUser(user)
      setProfileFromCache(false)
      if (claims?.sub) void saveCachedProfile(claims.sub, user)
      reportStatus("auth", "success", text.loggedIn())
      return null
    } catch (error) {
      const message = extractLoginErrorMessage(error)
      if (message.includes("a0.session.user_cancelled") || message.includes("USER_CANCELLED")) {
        reportStatus("auth", "idle", "")
        return null
      }
      if (/unauthorized/i.test(message)) {
        const msg = buildAuth0UnauthorizedMessage(apiUrl)
        reportStatus("auth", "error", msg)
        return msg
      }
      logStatusDetail("session.login", error)
      const msg = text.loginFailed()
      reportStatus("auth", "error", msg)
      return msg
    }
  }, [apiUrl, endRefusedSession, getAuth0, reportStatus, setProfileFromUser])

  const handleForgotPassword = useCallback(async (): Promise<void> => {
    try {
      const auth0 = getAuth0()
      const credentials = await auth0.webAuth.authorize({
        scope: "openid profile email offline_access",
        audience: AUTH0_AUDIENCE,
      })
      // If the user ended up logging in during the reset flow, treat it as a login
      await auth0.credentialsManager.saveCredentials(credentials)
      setAccessToken(credentials.accessToken)
      const claims = extractIdTokenClaims(credentials.idToken)
      setSessionOwner(claims)
      let refused = false
      const user = await getMyProfile(apiUrl, credentials.accessToken).catch((error: unknown) => {
        refused = isEmailAlreadyLinkedError(error)
        return null
      })
      if (refused) {
        await endRefusedSession()
        return
      }
      if (user) {
        setProfileFromUser(user)
        setProfileFromCache(false)
        if (claims?.sub) void saveCachedProfile(claims.sub, user)
        reportStatus("auth", "success", text.loggedIn())
      }
    } catch {
      // Cancellation and errors are silent: the user just wanted to reset their password
      reportStatus("auth", "idle", "")
    }
  }, [apiUrl, endRefusedSession, getAuth0, reportStatus, setProfileFromUser])

  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      const auth0 = getAuth0()
      await auth0.webAuth.clearSession()
    } catch {
      // Continue with local logout even if Auth0 session clearing fails
    }
    await getAuth0().credentialsManager.clearCredentials()
    await clearSession()
    reportStatus("auth", "success", text.loggedOut())
  }, [clearSession, getAuth0, reportStatus])

  const refreshSessionTokens = useCallback(async (): Promise<{
    accessToken: string
  } | null> => {
    try {
      const token = await getValidAccessToken({ forceRefresh: true })
      return { accessToken: token }
    } catch (error) {
      if (error instanceof Error && error.message === AUTH_REQUIRED_ERROR) return null
      throw error
    }
  }, [getValidAccessToken])

  // D-13: while the currently-shown profile came from the cache, retry GET
  // /me as soon as the network comes back and periodically while online, and
  // replace the cached profile once it succeeds. Stops (effect cleanup runs)
  // once handleLoadMyProfile succeeds and flips profileFromCache to false.
  useEffect(() => {
    if (!profileFromCache) {
      return
    }

    const attemptRefresh = async (): Promise<void> => {
      if (profileRefreshInFlightRef.current) return
      profileRefreshInFlightRef.current = true
      try {
        await handleLoadMyProfile({ silent: true })
      } finally {
        profileRefreshInFlightRef.current = false
      }
    }

    const subscription = Network.addNetworkStateListener((state) => {
      if (isOnlineNetworkState(state)) {
        void attemptRefresh()
      }
    })

    const intervalId = setInterval(() => {
      void (async () => {
        if (await isDeviceOnline()) {
          void attemptRefresh()
        }
      })()
    }, PROFILE_REFRESH_INTERVAL_MS)

    return () => {
      subscription.remove()
      clearInterval(intervalId)
    }
  }, [profileFromCache, handleLoadMyProfile])

  return {
    accessToken,
    sessionRestoring,
    currentUser,
    profile,
    sessionOwner,
    isAuthenticated: Boolean(currentUser),
    setProfileFromUser,
    clearSession,
    refreshSessionTokens,
    withAuthRetry,
    handleLoadMyProfile,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleLogout,
  }
}
