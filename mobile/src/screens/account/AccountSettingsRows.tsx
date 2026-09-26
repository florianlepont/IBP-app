import { useState } from "react"
import { Alert, LayoutAnimation, View } from "react-native"
import { AuthUser } from "../../app/types"
import { AppButton } from "../../ui/AppButton"
import { AppField } from "../../ui/AppField"
import { AppSettingsRow } from "../../ui/AppSettingsRow"
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
    Alert.alert(
      "Réinitialiser le mot de passe",
      `Un email de réinitialisation sera envoyé à ${currentUser.email ?? "votre adresse email"}.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Envoyer", onPress: () => void onPasswordReset() },
      ],
    )
  }

  return (
    <>
      {emailEditing ? (
        <View style={styles.emailEditBlock}>
          <AppField
            label="Nouvel email"
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
            error={newEmail.length > 0 && !isValidEmail(newEmail) ? "Email invalide" : undefined}
          />
          <View style={styles.emailEditActions}>
            <AppButton label="Annuler" variant="secondary" size="sm" onPress={closeEmailEditor} />
            <AppButton
              label="Enregistrer"
              size="sm"
              loading={profileUpdating}
              disabled={profileUpdating || !isValidEmail(newEmail)}
              onPress={() => void onChangeEmail(newEmail).then(closeEmailEditor)}
            />
          </View>
        </View>
      ) : (
        <AppSettingsRow
          label="Email"
          value={currentUser.email ?? "—"}
          accessibilityLabel="Modifier l'adresse email"
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            setNewEmail(currentUser.email ?? "")
            setEmailEditing(true)
          }}
        />
      )}

      {/* ACC-I08 : value = action courte, pas une description longue */}
      <AppSettingsRow
        label="Mot de passe"
        value="Réinitialiser"
        accessibilityLabel="Réinitialiser le mot de passe"
        onPress={handlePasswordReset}
      />
    </>
  )
}

// ACC-10 : Logout déplacé en bas, séparé de la carte identité
export function LogoutButton({ onLogout }: { onLogout: () => Promise<void> }) {
  // ACC-I05 : confirmation avant déconnexion
  const handleLogout = (): void => {
    Alert.alert("Se déconnecter", "Vous serez déconnecté de votre compte.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void onLogout() },
    ])
  }

  return (
    <AppButton
      label="Se déconnecter"
      leadingIcon="log-out-outline"
      variant="secondary"
      onPress={handleLogout}
      style={accountStyles.logoutButton}
    />
  )
}
