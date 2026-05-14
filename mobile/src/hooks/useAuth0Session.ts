import { useCallback, useEffect, useRef, useState } from "react"
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
import { AuthUser } from "../app/types"
import { OperationScope, OperationState } from "./operation-status"

export const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED"
function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 401
  if (error instanceof Error) return /401|unauthorized|auth_required/i.test(error.message)
  return false
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
  const auth0Ref = useRef<Auth0 | null>(null)

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
    await onSessionCleared?.()
  }, [onSessionCleared])

  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const credentials = await getAuth0().credentialsManager.getCredentials()
      if (credentials?.accessToken) {
        setAccessToken(credentials.accessToken)
        return credentials.accessToken
      }
      return null
    } catch {
      return null
    }
  }, [getAuth0])

  const withAuthRetry = useCallback(
    async <T>(operation: (token: string) => Promise<T>): Promise<T> => {
      const token = await getValidAccessToken()
      if (!token) throw new Error(AUTH_REQUIRED_ERROR)

      try {
        return await operation(token)
      } catch (error) {
        if (!isUnauthorizedError(error)) throw error

        // Force a fresh token on 401
        const refreshed = await getValidAccessToken()
        if (!refreshed) throw new Error(AUTH_REQUIRED_ERROR)
        return operation(refreshed)
      }
    },
    [getValidAccessToken],
  )

  const handleLoadMyProfile = useCallback(
    async (options?: { silent?: boolean }): Promise<AuthUser | null> => {
      const silent = options?.silent ?? false
      try {
        const user = await withAuthRetry((token) => getMyProfile(apiUrl, token))
        setProfileFromUser(user)
        if (!silent) reportStatus("profile", "success", "Profile loaded")
        return user
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          if (!silent) reportStatus("profile", "error", "Login required before loading profile")
          return null
        }
        if (!silent)
          reportStatus("profile", "error", `Profile load error: ${(error as Error).message}`)
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
        // DEV ONLY: slow down session restore to test the loading screen
        const auth0 = getAuth0()
        const hasCredentials = await auth0.credentialsManager.hasValidCredentials()
        if (!hasCredentials) {
          if (active) {
            reportStatus("session", "idle", "Ready")
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

        const user = await getMyProfile(apiUrlRef.current, credentials.accessToken).catch(() => null)
        if (!active) return

        if (!user) {
          reportStatus(
            "session",
            "success",
            "Session restored (offline). Profile will load when API is reachable",
          )
          setSessionRestoring(false)
          return
        }

        setProfileFromUser(user)
        reportStatus("session", "success", "Session restored")
        setSessionRestoring(false)
      } catch (error) {
        if (!active) return
        await clearSession().catch(() => undefined)
        reportStatus("session", "error", `Session restore error: ${(error as Error).message}`)
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
      reportStatus("auth", "running", "Logging in...")
      const auth0 = getAuth0()
      const credentials = await auth0.webAuth.authorize({
        scope: "openid profile email offline_access",
        audience: AUTH0_AUDIENCE,
      })

      await auth0.credentialsManager.saveCredentials(credentials)
      setAccessToken(credentials.accessToken)

      let user: AuthUser
      try {
        user = await getMyProfile(apiUrl, credentials.accessToken)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const msg = buildApiTokenRejectedMessage(apiUrl)
          reportStatus("auth", "error", msg)
          return msg
        }
        throw error
      }

      setProfileFromUser(user)
      reportStatus("auth", "success", "Logged in")
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
      const msg = `Login error: ${message}`
      reportStatus("auth", "error", msg)
      return msg
    }
  }, [apiUrl, getAuth0, reportStatus, setProfileFromUser])

  const handleRegister = useCallback(async (): Promise<string | null> => {
    try {
      reportStatus("auth", "running", "Logging in...")
      const auth0 = getAuth0()
      const credentials = await auth0.webAuth.authorize({
        scope: "openid profile email offline_access",
        audience: AUTH0_AUDIENCE,
        additionalParameters: { screen_hint: "signup" },
      })

      await auth0.credentialsManager.saveCredentials(credentials)
      setAccessToken(credentials.accessToken)

      let user: AuthUser
      try {
        user = await getMyProfile(apiUrl, credentials.accessToken)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const msg = buildApiTokenRejectedMessage(apiUrl)
          reportStatus("auth", "error", msg)
          return msg
        }
        throw error
      }

      setProfileFromUser(user)
      reportStatus("auth", "success", "Logged in")
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
      const msg = `Login error: ${message}`
      reportStatus("auth", "error", msg)
      return msg
    }
  }, [apiUrl, getAuth0, reportStatus, setProfileFromUser])

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
      const user = await getMyProfile(apiUrl, credentials.accessToken).catch(() => null)
      if (user) {
        setProfileFromUser(user)
        reportStatus("auth", "success", "Logged in")
      }
    } catch {
      // Cancellation and errors are silent: the user just wanted to reset their password
      reportStatus("auth", "idle", "")
    }
  }, [apiUrl, getAuth0, reportStatus, setProfileFromUser])

  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      const auth0 = getAuth0()
      await auth0.webAuth.clearSession()
    } catch {
      // Continue with local logout even if Auth0 session clearing fails
    }
    await getAuth0().credentialsManager.clearCredentials()
    await clearSession()
    reportStatus("auth", "success", "Logged out")
  }, [clearSession, getAuth0, reportStatus])

  const refreshSessionTokens = useCallback(async (): Promise<{
    accessToken: string
    refreshToken: string
  } | null> => {
    const token = await getValidAccessToken()
    if (!token) return null
    return { accessToken: token, refreshToken: "" }
  }, [getValidAccessToken])

  return {
    accessToken,
    refreshToken: "", // Managed internally by Auth0 CredentialsManager
    sessionRestoring,
    currentUser,
    profile,
    isAuthenticated: Boolean(currentUser),
    pendingEmailVerification: null,
    devVerificationToken: null,
    setProfileFromUser,
    clearSession,
    refreshSessionTokens,
    ensureAccessToken: getValidAccessToken,
    withAuthRetry,
    handleLoadMyProfile,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleLogout,
    handleCancelEmailVerification: async () => undefined,
    handleVerifyEmail: async (_token: string) => undefined,
    handleResendVerification: async () => undefined,
  }
}
