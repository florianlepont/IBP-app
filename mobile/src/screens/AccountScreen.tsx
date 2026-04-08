import { useEffect, useMemo, useRef, useState } from "react"
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { useHeaderHeight } from "@react-navigation/elements"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  brandColors,
  brandComponentTokens,
  brandRadius,
  brandSemanticColors,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"
import { AuthUser } from "../app/types"
import { useAppBottomTabBarHeight } from "../app/useAppBottomTabBarHeight"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { AppSettingsRow } from "../ui/AppSettingsRow"
import { AppStatusChip } from "../ui/AppStatusChip"

type UpdateProfileInput = {
  first_name: string
  last_name: string
  display_name: string
}

type AccountScreenProps = {
  accessToken: string
  currentUser: AuthUser | null
  profile: string
  profileUpdating: boolean
  apiUrl: string
  onSaveProfile: (input: UpdateProfileInput) => Promise<void>
  onChangeEmail: (newEmail: string) => Promise<void>
  onPasswordReset: () => Promise<void>
  onPickProfilePictureFromLibrary: () => Promise<void>
  onTakeProfilePictureFromCamera: () => Promise<void>
  onRemoveProfilePicture: () => Promise<void>
  onLogout: () => Promise<void>
}

// ACC-06 : validation email correcte
const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const resolveInitials = (user: AuthUser | null, fallbackProfile: string): string => {
  const source =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.display_name?.trim() ||
    user?.email?.trim() ||
    fallbackProfile.trim() ||
    "Account"

  return source
    .split(/[\s@._-]+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function AccountScreen({
  accessToken,
  currentUser,
  profile,
  profileUpdating,
  apiUrl,
  onSaveProfile,
  onChangeEmail,
  onPasswordReset,
  onPickProfilePictureFromLibrary,
  onTakeProfilePictureFromCamera,
  onRemoveProfilePicture,
  onLogout,
}: AccountScreenProps) {
  const headerHeight = useHeaderHeight()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useAppBottomTabBarHeight(Platform.select({ ios: 84, default: 68 }) ?? 68)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [emailEditing, setEmailEditing] = useState(false)
  const [newEmail, setNewEmail] = useState("")

  // ACC-13 : refs pour le chaining de focus clavier
  const lastNameRef = useRef<TextInput>(null)
  const displayNameRef = useRef<TextInput>(null)

  useEffect(() => {
    setFirstName(currentUser?.first_name ?? "")
    setLastName(currentUser?.last_name ?? "")
    setDisplayName(currentUser?.display_name ?? "")
  }, [currentUser])

  const profilePictureUri = useMemo(() => {
    const raw = currentUser?.profile_picture_url
    if (!raw) return null
    if (/^https?:\/\//i.test(raw)) return raw
    const trimmedBase = apiUrl.replace(/\/+$/, "")
    const path = raw.startsWith("/") ? raw : `/${raw}`
    return `${trimmedBase}${path}`
  }, [apiUrl, currentUser?.profile_picture_url])

  const isProfileDirty = useMemo(() => {
    return (
      firstName.trim() !== (currentUser?.first_name ?? "").trim() ||
      lastName.trim() !== (currentUser?.last_name ?? "").trim() ||
      displayName.trim() !== (currentUser?.display_name ?? "").trim()
    )
  }, [currentUser, firstName, lastName, displayName])

  const heroName =
    displayName.trim() ||
    [firstName.trim(), lastName.trim()].filter((p) => p.length > 0).join(" ") ||
    currentUser?.display_name ||
    profile ||
    "Compte"
  const heroSubtitle = currentUser?.email ?? "Aucun email associé"
  const initials = resolveInitials(currentUser, profile)
  const roleLabel = currentUser?.role?.trim() || "membre"
  // Keep header/tab bar clearance inside the scroll content so it scrolls away naturally.
  const topContentPadding = Platform.OS === "ios" ? headerHeight + brandSpacing.md : brandSpacing.md
  const bottomContentPadding = Math.max(tabBarHeight, insets.bottom) + brandSpacing.md

  // ACC-01 : Action Sheet native au lieu du Modal custom
  const openPhotoActions = (): void => {
    const options = ["Annuler", "Prendre une photo", "Choisir depuis la galerie"]
    const actions = [
      () => void onTakeProfilePictureFromCamera(),
      () => void onPickProfilePictureFromLibrary(),
    ]
    if (profilePictureUri) {
      options.push("Supprimer la photo")
      actions.push(() => void onRemoveProfilePicture())
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Photo de profil",
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: profilePictureUri ? options.length - 1 : undefined,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) actions[buttonIndex - 1]()
        },
      )
    } else {
      // Android fallback via Alert
      Alert.alert(
        "Photo de profil",
        undefined,
        [
          { text: "Prendre une photo", onPress: () => void onTakeProfilePictureFromCamera() },
          {
            text: "Choisir depuis la galerie",
            onPress: () => void onPickProfilePictureFromLibrary(),
          },
          ...(profilePictureUri
            ? [
                {
                  text: "Supprimer la photo",
                  style: "destructive" as const,
                  onPress: () => void onRemoveProfilePicture(),
                },
              ]
            : []),
          { text: "Annuler", style: "cancel" as const },
        ],
        { cancelable: true },
      )
    }
  }

  // ACC-I05 : confirmation avant reset mot de passe
  const handlePasswordReset = (): void => {
    Alert.alert(
      "Réinitialiser le mot de passe",
      `Un email de réinitialisation sera envoyé à ${currentUser?.email ?? "votre adresse email"}.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Envoyer", onPress: () => void onPasswordReset() },
      ],
    )
  }

  // ACC-I05 : confirmation avant déconnexion
  const handleLogout = (): void => {
    Alert.alert(
      "Se déconnecter",
      "Vous serez déconnecté de votre compte.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Se déconnecter", style: "destructive", onPress: () => void onLogout() },
      ],
    )
  }

  // ACC-C02 : état de chargement quand currentUser n'est pas encore disponible
  if (currentUser === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={brandColors.forest} />
      </View>
    )
  }

  return (
    // ACC-04 : ScrollView pour gérer le clavier et les petits écrans
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topContentPadding,
          paddingBottom: bottomContentPadding,
          paddingHorizontal: brandSpacing.md,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      scrollIndicatorInsets={{
        top: Platform.OS === "ios" ? headerHeight : 0,
        bottom: tabBarHeight,
      }}
    >
      {/* ACC-14 : Carte d'identité en variant hero (fond forest) */}
      <AppCard variant="hero" padding={brandComponentTokens.card.compactPadding} style={styles.identityCard}>
        <View style={styles.identityRow}>
          {/* ACC-11 : Avatar avec badge caméra */}
          <Pressable
            style={styles.avatarButton}
            onPress={openPhotoActions}
            disabled={profileUpdating}
            accessibilityRole="button"
            accessibilityLabel="Modifier la photo de profil"
            accessibilityHint="Ouvre les options de photo"
            hitSlop={{ top: 4, right: 4, bottom: 4, left: 0 }}
          >
            {profilePictureUri ? (
              <Image
                source={{
                  uri: profilePictureUri,
                  headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
                }}
                style={styles.avatarImage}
                accessible={false}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText} accessible={false}>
                  {initials || "A"}
                </Text>
              </View>
            )}
            {/* ACC-C01 : Badge caméra agrandi à 28pt, centrage icône garanti */}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={13} color={brandColors.white} />
            </View>
          </Pressable>

          <View style={styles.identityCopy}>
            <Text style={styles.identityName} numberOfLines={1}>
              {heroName}
            </Text>
            <Text style={styles.identityMeta} numberOfLines={1}>
              {heroSubtitle}
            </Text>
            {/* ACC-I07 : chip de rôle avec tone onDark pour s'intégrer au fond forest */}
            <View style={styles.identityFooter}>
              <AppStatusChip label={roleLabel} tone="onDark" />
            </View>
          </View>
        </View>
      </AppCard>

      {/* Carte profil */}
      <AppCard variant="panelElevated" padding={brandComponentTokens.card.compactPadding} style={styles.panel}>
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
              onChangeText={setFirstName}
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
              onChangeText={setLastName}
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
          onChangeText={setDisplayName}
          placeholder="ex. F. Lepont"
          autoCapitalize="words"
          autoCorrect={false}
          inputRef={displayNameRef}
          containerStyle={styles.fieldGroup}
          labelStyle={styles.fieldLabel}
          inputStyle={styles.fieldInput}
          returnKeyType="done"
        />

        {/* ACC-09 : AppSettingsRow pour Email et Mot de passe */}
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
              error={
                newEmail.length > 0 && !isValidEmail(newEmail) ? "Email invalide" : undefined
              }
            />
            <View style={styles.emailEditActions}>
              <AppButton
                label="Annuler"
                variant="secondary"
                size="sm"
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                  setEmailEditing(false)
                  setNewEmail("")
                }}
              />
              <AppButton
                label="Enregistrer"
                size="sm"
                loading={profileUpdating}
                disabled={profileUpdating || !isValidEmail(newEmail)}
                onPress={() =>
                  void onChangeEmail(newEmail).then(() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                    setEmailEditing(false)
                    setNewEmail("")
                  })
                }
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

        {/* ACC-I06 : bouton Enregistrer visible uniquement si des modifications sont en cours */}
        {isProfileDirty && (
          <AppButton
            label={profileUpdating ? "Enregistrement..." : "Enregistrer le profil"}
            leadingIcon={profileUpdating ? undefined : "save-outline"}
            loading={profileUpdating}
            onPress={() =>
              void onSaveProfile({
                first_name: firstName,
                last_name: lastName,
                display_name: displayName,
              })
            }
            disabled={profileUpdating}
            size="lg"
          />
        )}
      </AppCard>

      {/* ACC-10 : Logout déplacé en bas, séparé de la carte identité */}
      <AppButton
        label="Se déconnecter"
        leadingIcon="log-out-outline"
        variant="secondary"
        onPress={handleLogout}
        style={styles.logoutButton}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.canvas,
  },
  // ACC-N02 : gap inter-sections avec brandSpacing.md pour une meilleure respiration
  content: {
    gap: brandSpacing.md,
    paddingBottom: brandSpacing.xl,
  },
  identityCard: {
    gap: 0,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: brandSpacing.sm + 2,
  },
  avatarButton: {
    width: 72,
    height: 72,
    borderRadius: brandRadius.avatar,
    overflow: "visible",
    flexShrink: 0,
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: brandRadius.avatar,
    borderWidth: 2,
    borderColor: brandColors.canvas,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: brandRadius.avatar,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
    borderWidth: 2,
    borderColor: brandColors.canvas,
  },
  avatarFallbackText: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "900",
    color: brandColors.forest,
  },
  // ACC-C01 : badge caméra agrandi à 28pt pour une meilleure cible tactile visuelle
  avatarEditBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: brandColors.forest,
    borderWidth: 2,
    borderColor: brandColors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  identityCopy: {
    flex: 1,
    gap: 3,
  },
  identityName: {
    ...brandTypography.sectionTitle,
    fontSize: 18,
    lineHeight: 22,
    // ACC-14 : texte clair sur fond hero forest
    color: brandColors.canvas,
  },
  identityMeta: {
    ...brandTypography.meta,
    // ACC-14 : texte secondaire sur fond forest
    color: brandSemanticColors.heroBodyOnDark,
  },
  identityFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  panel: {
    gap: brandSpacing.xs + 2,
  },
  panelHeader: {
    marginBottom: brandSpacing.xs - 2,
  },
  panelTitle: {
    fontSize: 17,
    lineHeight: 20,
  },
  twoColumnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: brandSpacing.sm,
  },
  halfField: {
    flex: 1,
    minWidth: 120,
  },
  // ACC-12 : styles de champ directement sur AppField (sans wrapper ProfileField)
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  fieldInput: {
    paddingHorizontal: 14,
    paddingVertical: brandSpacing.sm,
  },
  emailEditBlock: {
    gap: brandSpacing.xs + 2,
  },
  emailEditActions: {
    flexDirection: "row",
    gap: brandSpacing.xs + 2,
    justifyContent: "flex-end",
  },
  // ACC-10 : Logout en bas, style discret
  logoutButton: {
    marginTop: brandSpacing.xs,
  },
})
