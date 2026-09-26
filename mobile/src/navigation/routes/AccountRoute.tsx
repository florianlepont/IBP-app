import { memo } from "react"
import { KeyboardAvoidingView, Platform } from "react-native"
import { styles } from "../../app/styles"
import { AccountScreen } from "../../screens/AccountScreen"
import { useAccessToken, useSession } from "../../state/session-context"
import type { AccountRouteProps } from "../types"

/**
 * Account route (phase 01.9-18, D-01): reads the session and, as the only
 * route, the access token (for the avatar, T-01.9-31).
 */
export const AccountRoute = memo(function AccountRoute(_props: AccountRouteProps) {
  const { state: session, actions } = useSession()
  const accessToken = useAccessToken()

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.accountScreenWrap}
    >
      <AccountScreen
        accessToken={accessToken ?? ""}
        currentUser={session.currentUser}
        profile={session.profile}
        profileUpdating={session.profileUpdating}
        apiUrl={session.apiUrl}
        onSaveProfile={actions.handleUpdateProfile}
        onChangeEmail={actions.handleChangeEmail}
        onPasswordReset={actions.handlePasswordReset}
        onPickProfilePictureFromLibrary={actions.handlePickProfilePictureFromLibrary}
        onTakeProfilePictureFromCamera={actions.handleTakeProfilePictureFromCamera}
        onRemoveProfilePicture={actions.handleRemoveProfilePicture}
        onLogout={actions.handleLogout}
      />
    </KeyboardAvoidingView>
  )
})
