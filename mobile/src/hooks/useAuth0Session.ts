import { useCallback, useEffect, useState } from "react"
import Auth0 from "react-native-auth0"
import { ApiError } from "../api/client"
import { getMyProfile } from "../api/ibp-api"
import { AuthUser } from "../app/types"
import { OperationScope, OperationState } from "./operation-status"

export const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED"

const AUTH0_DOMAIN = "auth-ibp.algernon.ovh"
const AUTH0_CLIENT_ID = "qaOBdPPo7eIMadCmIq5qDhmEGOqZF6py"
const AUTH0_AUDIENCE = "https://api.ibp-app"

const auth0 = new Auth0({ domain: AUTH0_DOMAIN, clientId: AUTH0_CLIENT_ID })

function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 401
  if (error instanceof Error) return /401|unauthorized|auth_required/i.test(error.message)
  return false
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
      const credentials = await auth0.credentialsManager.getCredentials()
      if (credentials?.accessToken) {
        setAccessToken(credentials.accessToken)
        return credentials.accessToken
      }
      return null
    } catch {
      return null
    }
  }, [])

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

        const user = await getMyProfile(apiUrl, credentials.accessToken).catch(() => null)
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
  }, [apiUrl, clearSession, reportStatus, setProfileFromUser])

  const handleLogin = useCallback(async (): Promise<void> => {
    try {
      reportStatus("auth", "running", "Logging in...")
      const credentials = await auth0.webAuth.authorize({
        scope: "openid profile email offline_access",
        audience: AUTH0_AUDIENCE,
      })

      await auth0.credentialsManager.saveCredentials(credentials)
      setAccessToken(credentials.accessToken)

      const user = await getMyProfile(apiUrl, credentials.accessToken)
      setProfileFromUser(user)
      reportStatus("auth", "success", "Logged in")
    } catch (error) {
      const message = (error as Error).message ?? ""
      // User cancelled the login flow
      if (message.includes("a0.session.user_cancelled") || message.includes("USER_CANCELLED")) {
        reportStatus("auth", "idle", "")
        return
      }
      reportStatus("auth", "error", `Login error: ${message}`)
    }
  }, [apiUrl, reportStatus, setProfileFromUser])

  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      await auth0.webAuth.clearSession()
    } catch {
      // Continue with local logout even if Auth0 session clearing fails
    }
    await auth0.credentialsManager.clearCredentials()
    await clearSession()
    reportStatus("auth", "success", "Logged out")
  }, [clearSession, reportStatus])

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
    handleRegister: handleLogin, // Auth0 handles signup in the same flow
    handleLogout,
    handleCancelEmailVerification: async () => undefined,
    handleVerifyEmail: async (_token: string) => undefined,
    handleResendVerification: async () => undefined,
  }
}
