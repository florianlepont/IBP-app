import { useMemo } from "react"
import { ActionSheetIOS, Alert, Image, Platform, Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { brandColors, brandComponentTokens } from "../../app/brand-tokens"
import { AuthUser } from "../../app/types"
import { AppCard } from "../../ui/AppCard"
import { AppStatusChip } from "../../ui/AppStatusChip"
import { identityStyles as styles } from "./styles"

export type IdentityCardProps = {
  // The only reader of the access token on the account screen: it signs the
  // profile picture request.
  accessToken: string
  apiUrl: string
  currentUser: AuthUser
  profile: string
  heroName: string
  profileUpdating: boolean
  onPickProfilePictureFromLibrary: () => Promise<void>
  onTakeProfilePictureFromCamera: () => Promise<void>
  onRemoveProfilePicture: () => Promise<void>
}

export const resolveInitials = (user: AuthUser | null, fallbackProfile: string): string => {
  const source =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    user?.display_name?.trim() ||
    user?.email?.trim() ||
    fallbackProfile.trim() ||
    "Compte"

  return source
    .split(/[\s@._-]+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export const resolveProfilePictureUri = (raw: string | null | undefined, apiUrl: string) => {
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  const trimmedBase = apiUrl.replace(/\/+$/, "")
  const path = raw.startsWith("/") ? raw : `/${raw}`
  return `${trimmedBase}${path}`
}

export function IdentityCard({
  accessToken,
  apiUrl,
  currentUser,
  profile,
  heroName,
  profileUpdating,
  onPickProfilePictureFromLibrary,
  onTakeProfilePictureFromCamera,
  onRemoveProfilePicture,
}: IdentityCardProps) {
  const profilePictureUri = useMemo(
    () => resolveProfilePictureUri(currentUser.profile_picture_url, apiUrl),
    [apiUrl, currentUser.profile_picture_url],
  )
  const heroSubtitle = currentUser.email ?? "Aucun email associé"
  const initials = resolveInitials(currentUser, profile)
  const roleLabel = currentUser.role?.trim() || "membre"

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

  return (
    // ACC-14 : Carte d'identité en variant hero (fond forest)
    <AppCard
      variant="hero"
      padding={brandComponentTokens.card.compactPadding}
      style={styles.identityCard}
    >
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
  )
}
