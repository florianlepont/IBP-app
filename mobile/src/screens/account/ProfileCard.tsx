import { ReactNode, useRef } from "react"
import { TextInput, View } from "react-native"
import { brandComponentTokens } from "../../app/brand-tokens"
import { AppButton } from "../../ui/AppButton"
import { AppCard } from "../../ui/AppCard"
import { AppField } from "../../ui/AppField"
import { AppSectionHeader } from "../../ui/AppSectionHeader"
import { AppStatusChip } from "../../ui/AppStatusChip"
import { profileStyles as styles } from "./styles"

type ProfileCardProps = {
  firstName: string
  lastName: string
  displayName: string
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onDisplayNameChange: (value: string) => void
  isProfileDirty: boolean
  profileUpdating: boolean
  onSave: () => void
  // The e-mail and password rows, rendered between the fields and the save button.
  children?: ReactNode
}

export function ProfileCard({
  firstName,
  lastName,
  displayName,
  onFirstNameChange,
  onLastNameChange,
  onDisplayNameChange,
  isProfileDirty,
  profileUpdating,
  onSave,
  children,
}: ProfileCardProps) {
  // ACC-13 : refs pour le chaining de focus clavier
  const lastNameRef = useRef<TextInput>(null)
  const displayNameRef = useRef<TextInput>(null)

  return (
    <AppCard
      variant="panelElevated"
      padding={brandComponentTokens.card.compactPadding}
      style={styles.panel}
    >
      {/* ACC-07 : AppSectionHeader au lieu du header custom */}
      <AppSectionHeader
        title="Profil"
        titleStyle={styles.panelTitle}
        trailing={
          isProfileDirty ? (
            <AppStatusChip label="Non sauvegardé" tone="warning" />
          ) : (
            <AppStatusChip label="Sauvegardé" tone="success" />
          )
        }
        style={styles.panelHeader}
      />

      <View style={styles.twoColumnRow}>
        <View style={styles.halfField}>
          {/* ACC-12 : AppField direct sans wrapper ProfileField */}
          {/* ACC-13 : returnKeyType + onSubmitEditing pour le chaining */}
          <AppField
            label="Prénom"
            value={firstName}
            onChangeText={onFirstNameChange}
            placeholder="Florian"
            autoCapitalize="words"
            autoCorrect={false}
            containerStyle={styles.fieldGroup}
            labelStyle={styles.fieldLabel}
            inputStyle={styles.fieldInput}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => lastNameRef.current?.focus()}
          />
        </View>
        <View style={styles.halfField}>
          <AppField
            label="Nom"
            value={lastName}
            onChangeText={onLastNameChange}
            placeholder="Lepont"
            autoCapitalize="words"
            autoCorrect={false}
            inputRef={lastNameRef}
            containerStyle={styles.fieldGroup}
            labelStyle={styles.fieldLabel}
            inputStyle={styles.fieldInput}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => displayNameRef.current?.focus()}
          />
        </View>
      </View>

      {/* ACC-17 : placeholder = exemple, pas une description */}
      <AppField
        label="Nom d'affichage"
        value={displayName}
        onChangeText={onDisplayNameChange}
        placeholder="ex. F. Lepont"
        autoCapitalize="words"
        autoCorrect={false}
        inputRef={displayNameRef}
        containerStyle={styles.fieldGroup}
        labelStyle={styles.fieldLabel}
        inputStyle={styles.fieldInput}
        returnKeyType="done"
      />

      {children}

      {/* ACC-I06 : bouton Enregistrer visible uniquement si des modifications sont en cours */}
      {isProfileDirty && (
        <AppButton
          label={profileUpdating ? "Enregistrement..." : "Enregistrer le profil"}
          leadingIcon={profileUpdating ? undefined : "save-outline"}
          loading={profileUpdating}
          onPress={onSave}
          disabled={profileUpdating}
          size="lg"
        />
      )}
    </AppCard>
  )
}
