import { useCallback, useEffect, useState } from "react"
import { AuthUser } from "../app/types"
import { ApiError } from "../api/client"
import {
  getMyProfile,
  loginWithCredentials,
  logoutSession,
  refreshAuthTokens,
  registerWithCredentials,
  resendVerificationEmail,
  verifyEmail,
} from "../api/ibp-api"
import {
  clearStoredAuthSession,
  loadStoredAuthSession,
  saveStoredAuthSession,
} from "../auth/session-storage"
import { OperationScope, OperationState } from "./operation-status"

export const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED"

const isUnauthorizedMessage = (message: string): boolean =>
  /(^|[^0-9])401([^0-9]|$)|unauthorized|auth_required/i.test(message)

function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 401
  }

  if (error instanceof Error) {
    return isUnauthorizedMessage(error.message ?? "")
  }

  return false
}

type UseAuthSessionParams = {
  apiUrl: string
  email: string
  password: string
  displayName: string
  reportStatus: (scope: OperationScope, state: OperationState, message: string) => void
  onSessionCleared?: () => void | Promise<void>
}

export function useAuthSession({
  apiUrl,
  email,
  password,
  displayName,
  reportStatus,
  onSessionCleared,
}: UseAuthSessionParams) {
  const [accessToken, setAccessToken] = useState("")
  const [refreshToken, setRefreshToken] = useState("")
  const [sessionRestoring, setSessionRestoring] = useState(true)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<string>("Not logged in")
  const [pendingEmailVerification, setPendingEmailVerification] = useState<string | null>(null)

  const setProfileFromUser = useCallback((user: AuthUser): void => {
    setCurrentUser(user)
    setProfile(`${user.display_name} (${user.email})`)
  }, [])

  const clearSession = useCallback(async (): Promise<void> => {
    setAccessToken("")
    setRefreshToken("")
    setSessionRestoring(false)
    setCurrentUser(null)
    setProfile("Not logged in")
    await clearStoredAuthSession()
    await onSessionCleared?.()
  }, [onSessionCleared])

  const refreshSessionTokens = useCallback(
    async (
      tokenOverride?: string,
    ): Promise<{ accessToken: string; refreshToken: string } | null> => {
      const activeRefreshToken = tokenOverride ?? refreshToken
      if (!activeRefreshToken || !activeRefreshToken.trim()) {
        return null
      }

      try {
        const payload = await refreshAuthTokens(apiUrl, activeRefreshToken)
        if (!payload.access_token || !payload.refresh_token) {
          return null
        }

        setAccessToken(payload.access_token)
        setRefreshToken(payload.refresh_token)
        await saveStoredAuthSession({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
        })

        return {
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
        }
      } catch {
        return null
      }
    },
    [apiUrl, refreshToken],
  )

  const ensureAccessToken = useCallback(async (): Promise<string | null> => {
    if (accessToken) {
      return accessToken
    }

    const refreshed = await refreshSessionTokens()
    return refreshed?.accessToken ?? null
  }, [accessToken, refreshSessionTokens])

  const withAuthRetry = useCallback(
    async <T>(operation: (token: string) => Promise<T>): Promise<T> => {
      const token = await ensureAccessToken()
      if (!token) {
        throw new Error(AUTH_REQUIRED_ERROR)
      }

      try {
        return await operation(token)
      } catch (error) {
        if (!isUnauthorizedError(error)) {
          throw error
        }

        const refreshed = await refreshSessionTokens()
        if (!refreshed?.accessToken) {
          throw new Error(AUTH_REQUIRED_ERROR)
        }
        return operation(refreshed.accessToken)
      }
    },
    [ensureAccessToken, refreshSessionTokens],
  )

  const handleLoadMyProfile = useCallback(
    async (options?: { silent?: boolean }): Promise<AuthUser | null> => {
      const silent = options?.silent ?? false
      try {
        const user = await withAuthRetry((token) => getMyProfile(apiUrl, token))
        setProfileFromUser(user)
        if (!silent) {
          reportStatus("profile", "success", "Profile loaded")
        }
        return user
      } catch (error) {
        if ((error as Error).message === AUTH_REQUIRED_ERROR) {
          await clearSession()
          if (!silent) {
            reportStatus("profile", "error", "Login required before loading profile")
          }
          return null
        }

        if (!silent) {
          reportStatus("profile", "error", `Profile load error: ${(error as Error).message}`)
        }
        return null
      }
    },
    [apiUrl, clearSession, reportStatus, setProfileFromUser, withAuthRetry],
  )

  useEffect(() => {
    let active = true

    const restoreSession = async (): Promise<void> => {
      try {
        if (active) {
          setSessionRestoring(true)
        }
        const stored = await loadStoredAuthSession()
        if (!stored) {
          if (active) {
            reportStatus("session", "idle", "Ready")
            setSessionRestoring(false)
          }
          return
        }

        if (active) {
          reportStatus("session", "running", "Restoring session...")
          setAccessToken(stored.accessToken)
          setRefreshToken(stored.refreshToken)
        }

        let nextAccessToken = stored.accessToken
        let nextRefreshToken = stored.refreshToken
        let lastProfileError: unknown = null
        let user = nextAccessToken
          ? await getMyProfile(apiUrl, nextAccessToken).catch((error) => {
              lastProfileError = error
              return null
            })
          : null

        if (!user) {
          try {
            const refreshed = await refreshAuthTokens(apiUrl, stored.refreshToken)
            if (refreshed.access_token && refreshed.refresh_token) {
              nextAccessToken = refreshed.access_token
              nextRefreshToken = refreshed.refresh_token
              user = await getMyProfile(apiUrl, nextAccessToken).catch((error) => {
                lastProfileError = error
                return null
              })
            }
          } catch {
            // Keep stored tokens and retry profile loading later when network is back.
          }
        }

        if (!active) {
          return
        }

        if (!user) {
          if (isUnauthorizedError(lastProfileError)) {
            await clearSession()
            reportStatus("session", "error", "Session expired. Please login")
            return
          }
          setAccessToken(nextAccessToken)
          setRefreshToken(nextRefreshToken)
          reportStatus(
            "session",
            "success",
            "Session restored (offline). Profile will load when API is reachable",
          )
          setSessionRestoring(false)
          return
        }

        setAccessToken(nextAccessToken)
        setRefreshToken(nextRefreshToken)
        setProfileFromUser(user)
        await saveStoredAuthSession({
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken,
        })
        reportStatus("session", "success", "Session restored")
        setSessionRestoring(false)
      } catch (error) {
        if (!active) {
          return
        }
        await clearSession().catch(() => undefined)
        reportStatus("session", "error", `Session restore error: ${(error as Error).message}`)
        setSessionRestoring(false)
      }
    }

    void restoreSession()

    return () => {
      active = false
    }
  }, [apiUrl, clearSession, reportStatus, setProfileFromUser])

  const handleLogin = useCallback(async (): Promise<void> => {
    try {
      setSessionRestoring(false)
      reportStatus("auth", "running", "Logging in...")
      const payload = await loginWithCredentials(apiUrl, email, password, {
        createIfMissing: false,
      })
      setAccessToken(payload.access_token)
      setRefreshToken(payload.refresh_token)
      setProfileFromUser(payload.user)
      await saveStoredAuthSession({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
      })
      reportStatus("auth", "success", "Logged in")
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setPendingEmailVerification(email.trim().toLowerCase())
        reportStatus("auth", "idle", "")
        return
      }
      reportStatus("auth", "error", `Login error: ${(error as Error).message}`)
    }
  }, [apiUrl, email, password, reportStatus, setProfileFromUser])

  const handleRegister = useCallback(async (): Promise<void> => {
    try {
      setSessionRestoring(false)
      reportStatus("auth", "running", "Creating account...")
      const payload = await registerWithCredentials(apiUrl, email, password, displayName)
      setAccessToken(payload.access_token)
      setRefreshToken(payload.refresh_token)
      setProfileFromUser(payload.user)
      await saveStoredAuthSession({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
      })
      setPendingEmailVerification(email.trim().toLowerCase())
      reportStatus("auth", "idle", "")
    } catch (error) {
      reportStatus("auth", "error", `Registration error: ${(error as Error).message}`)
    }
  }, [apiUrl, displayName, email, password, reportStatus, setProfileFromUser])

  const handleVerifyEmail = useCallback(
    async (token: string): Promise<void> => {
      await verifyEmail(apiUrl, token)
      setPendingEmailVerification(null)
    },
    [apiUrl],
  )

  const handleResendVerification = useCallback(async (): Promise<void> => {
    if (!pendingEmailVerification) return
    await resendVerificationEmail(apiUrl, pendingEmailVerification)
  }, [apiUrl, pendingEmailVerification])

  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      const token = await ensureAccessToken()
      if (token) {
        await logoutSession(apiUrl, token).catch(() => undefined)
      }
    } finally {
      await clearSession()
      reportStatus("auth", "success", "Logged out")
    }
  }, [apiUrl, clearSession, ensureAccessToken, reportStatus])

  return {
    accessToken,
    refreshToken,
    sessionRestoring,
    currentUser,
    profile,
    isAuthenticated: Boolean(accessToken || refreshToken),
    pendingEmailVerification,
    handleVerifyEmail,
    handleResendVerification,
    setProfileFromUser,
    clearSession,
    refreshSessionTokens,
    ensureAccessToken,
    withAuthRetry,
    handleLoadMyProfile,
    handleLogin,
    handleRegister,
    handleLogout,
  }
}
