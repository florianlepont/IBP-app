import { useState } from "react"
import { Alert, LayoutAnimation, View } from "react-native"
import { AuthUser } from "../../app/types"
import { AppButton } from "../../ui/AppButton"
import { AppField } from "../../ui/AppField"
import { AppSettingsRow } from "../../ui/AppSettingsRow"
import { fr } from "../../i18n"
import { accountStyles, profileStyles as styles } from "./styles"

// ACC-06 : validation email correcte
export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

type AccountSettingsRowsProps = {
  currentUser: AuthUser
  profileUpdating: boolean
  onChangeEmail: (newEmail: string) => Promise<void>
  onPasswordReset: () => Promise<void>
}

// ACC-09 : AppSettingsRow pour Email et Mot de passe
export function AccountSettingsRows({
  currentUser,
  profileUpdating,
  onChangeEmail,
  onPasswordReset,
}: AccountSettingsRowsProps) {
  const [emailEditing, setEmailEditing] = useState(false)
  const [newEmail, setNewEmail] = useState("")

  const closeEmailEditor = (): void => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setEmailEditing(false)
    setNewEmail("")
  }

  // ACC-I05 : confirmation avant reset mot de passe
  const handlePasswordReset = (): void => {
    const texts = fr.account.alerts.passwordReset
    Alert.alert(texts.title, texts.message(currentUser.email ?? texts.emailFallback), [
      { text: fr.common.actions.cancel, style: "cancel" },
      { text: texts.confirm, onPress: () => void onPasswordReset() },
    ])
  }

  return (
    <>
      {emailEditing ? (
        <View style={styles.emailEditBlock}>
          <AppField
            label={fr.account.email.newLabel}
            value={newEmail}
            onChangeText={setNewEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoFocus
            containerStyle={styles.fieldGroup}
            labelStyle={styles.fieldLabel}
            inputStyle={styles.fieldInput}
            returnKeyType="done"
            // ACC-06 : afficher une erreur inline si email invalide
            error={
              newEmail.length > 0 && !isValidEmail(newEmail) ? fr.account.email.invalid : undefined
            }
          />
          <View style={styles.emailEditActions}>
            <AppButton
              label={fr.common.actions.cancel}
              variant="secondary"
              size="sm"
              onPress={closeEmailEditor}
            />
            <AppButton
              label={fr.common.actions.save}
              size="sm"
              loading={profileUpdating}
              disabled={profileUpdating || !isValidEmail(newEmail)}
              onPress={() => void onChangeEmail(newEmail).then(closeEmailEditor)}
            />
          </View>
        </View>
      ) : (
        <AppSettingsRow
          label={fr.account.email.label}
          value={currentUser.email ?? fr.account.email.empty}
          accessibilityLabel={fr.account.a11y.editEmail}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            setNewEmail(currentUser.email ?? "")
            setEmailEditing(true)
          }}
        />
      )}

      {/* ACC-I08 : value = action courte, pas une description longue */}
      <AppSettingsRow
        label={fr.account.password.label}
        value={fr.account.password.action}
        accessibilityLabel={fr.account.a11y.resetPassword}
        onPress={handlePasswordReset}
      />
    </>
  )
}

// ACC-10 : Logout déplacé en bas, séparé de la carte identité
export function LogoutButton({ onLogout }: { onLogout: () => Promise<void> }) {
  // ACC-I05 : confirmation avant déconnexion
  const handleLogout = (): void => {
    const texts = fr.account.alerts.logout
    Alert.alert(texts.title, texts.message, [
      { text: fr.common.actions.cancel, style: "cancel" },
      { text: texts.confirm, style: "destructive", onPress: () => void onLogout() },
    ])
  }

  return (
    <AppButton
      label={fr.account.logout}
      leadingIcon="log-out-outline"
      variant="secondary"
      onPress={handleLogout}
      style={accountStyles.logoutButton}
    />
  )
}
