import { createContext, useContext } from "react"
import type { UnsyncedLocalWork } from "../app/local-data-owner"
import type { AuthUser } from "../app/types"
import type { useAuth0Session } from "../hooks/useAuth0Session"
import type { LocalDataOwnerStatus } from "../hooks/useLocalDataOwner"
import type { useSurveySyncProfile } from "../hooks/survey-sync/useSurveySyncProfile"

type Auth0Session = ReturnType<typeof useAuth0Session>
type ProfileOperations = ReturnType<typeof useSurveySyncProfile>

/**
 * Session context (phase 01.9, D-01): who is signed in, the profile and the
 * local-data owner status. It changes on login, logout, profile edits and owner
 * checks, never on a status message or a keystroke.
 *
 * The access token is NOT in this value (RESEARCH Pattern 1, T-01.9-17). It
 * changes on every refresh and only the avatar needs it, so it has its own
 * narrow context, read with useAccessToken().
 */
export type SessionState = {
  apiUrl: string
  isAuthenticated: boolean
  sessionRestoring: boolean
  currentUser: AuthUser | null
  profile: string
  profileUpdating: boolean
  localDataOwnerStatus: LocalDataOwnerStatus
  foreignWork: UnsyncedLocalWork
  foreignOwnerEmail: string | null
}

export type SessionActions = {
  setApiUrl: (value: string) => void
  handleLogin: Auth0Session["handleLogin"]
  handleRegister: Auth0Session["handleRegister"]
  handleForgotPassword: Auth0Session["handleForgotPassword"]
  handleLogout: () => Promise<void>
  handleLoadMyProfile: Auth0Session["handleLoadMyProfile"]
  handleUpdateProfile: ProfileOperations["handleUpdateProfile"]
  handleChangeEmail: ProfileOperations["handleChangeEmail"]
  handlePasswordReset: ProfileOperations["handlePasswordReset"]
  handleDeleteAccount: () => Promise<void>
  handlePickProfilePictureFromLibrary: ProfileOperations["handlePickProfilePictureFromLibrary"]
  handleTakeProfilePictureFromCamera: ProfileOperations["handleTakeProfilePictureFromCamera"]
  handleRemoveProfilePicture: ProfileOperations["handleRemoveProfilePicture"]
  handleSwitchToOwnerAccount: () => Promise<void>
  handleDiscardForeignData: () => void
}

export type SessionContextValue = {
  state: SessionState
  actions: SessionActions
}

/** Narrow value: only the components that send the token themselves read it. */
export type AccessTokenContextValue = {
  accessToken: string | null
}

export const SessionContext = createContext<SessionContextValue | null>(null)
export const AccessTokenContext = createContext<AccessTokenContextValue | null>(null)

export const SessionProvider = SessionContext.Provider
export const AccessTokenProvider = AccessTokenContext.Provider

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (value === null) {
    throw new Error("useSession must be used inside AppStateProvider")
  }
  return value
}

export function useAccessToken(): string | null {
  const value = useContext(AccessTokenContext)
  if (value === null) {
    throw new Error("useAccessToken must be used inside AppStateProvider")
  }
  return value.accessToken
}
