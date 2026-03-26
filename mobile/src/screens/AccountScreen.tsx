import { useEffect, useMemo, useRef, useState } from "react"
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { BlurView } from "expo-blur"
import { brandColors, brandSpacing, brandTypography } from "../app/brand-tokens"
import { AuthUser } from "../app/types"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { AppStatusChip } from "../ui/AppStatusChip"

type UpdateProfileInput = {
  first_name: string
  last_name: string
  display_name: string
}

const AUTH0_RESET_PASSWORD_URL =
  "https://dev-zocy4q27tkkmjkmd.eu.auth0.com/u/reset-password/request/Username-Password-Authentication"

type AccountScreenProps = {
  accessToken: string
  currentUser: AuthUser | null
  profile: string
  profileUpdating: boolean
  apiUrl: string
  onSaveProfile: (input: UpdateProfileInput) => Promise<void>
  onChangeEmail: (newEmail: string) => Promise<void>
  onPickProfilePictureFromLibrary: () => Promise<void>
  onTakeProfilePictureFromCamera: () => Promise<void>
  onRemoveProfilePicture: () => Promise<void>
  onLogout: () => Promise<void>
}

type PhotoMenuAnchor = { x: number; y: number; width: number; height: number }

function ProfileField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  autoCorrect,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  autoCapitalize?: "none" | "sentences" | "words" | "characters"
  autoCorrect?: boolean
}) {
  return (
    <AppField
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      containerStyle={styles.fieldGroup}
      labelStyle={styles.fieldLabel}
      inputStyle={styles.fieldInput}
    />
  )
}

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
  onPickProfilePictureFromLibrary,
  onTakeProfilePictureFromCamera,
  onRemoveProfilePicture,
  onLogout,
}: AccountScreenProps) {
  const avatarButtonRef = useRef<View | null>(null)
  const pendingPhotoActionRef = useRef<(() => void) | null>(null)
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [photoMenuVisible, setPhotoMenuVisible] = useState(false)
  const [photoMenuAnchor, setPhotoMenuAnchor] = useState<PhotoMenuAnchor | null>(null)
  const [emailEditing, setEmailEditing] = useState(false)
  const [newEmail, setNewEmail] = useState("")

  useEffect(() => {
    setFirstName(currentUser?.first_name ?? "")
    setLastName(currentUser?.last_name ?? "")
    setDisplayName(currentUser?.display_name ?? "")
  }, [currentUser])

  useEffect(() => {
    if (photoMenuVisible || !pendingPhotoActionRef.current) {
      return
    }

    const nextAction = pendingPhotoActionRef.current
    pendingPhotoActionRef.current = null
    const timeoutId = setTimeout(() => {
      nextAction()
    }, 220)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [photoMenuVisible])

  const profilePictureUri = useMemo(() => {
    const raw = currentUser?.profile_picture_url
    if (!raw) return null
    if (/^https?:\/\//i.test(raw)) return raw
    const trimmedBase = apiUrl.replace(/\/+$/, "")
    const path = raw.startsWith("/") ? raw : `/${raw}`
    return `${trimmedBase}${path}`
  }, [apiUrl, currentUser?.profile_picture_url])

  const isProfileDirty = useMemo(() => {
    const baseFirstName = (currentUser?.first_name ?? "").trim()
    const baseLastName = (currentUser?.last_name ?? "").trim()
    const baseDisplayName = (currentUser?.display_name ?? "").trim()

    return (
      firstName.trim() !== baseFirstName ||
      lastName.trim() !== baseLastName ||
      displayName.trim() !== baseDisplayName
    )
  }, [currentUser, firstName, lastName, displayName])

  const heroName =
    displayName.trim() ||
    [firstName.trim(), lastName.trim()].filter((part) => part.length > 0).join(" ") ||
    currentUser?.display_name ||
    profile ||
    "Account"
  const heroSubtitle = currentUser?.email ?? "No email attached yet"
  const initials = resolveInitials(currentUser, profile)
  const roleLabel = currentUser?.role?.trim() || "member"
  const photoActions = useMemo(
    () => [
      {
        key: "camera",
        label: "Take photo",
        icon: "camera-outline" as const,
        danger: false,
        action: () => {
          void onTakeProfilePictureFromCamera()
        },
      },
      {
        key: "gallery",
        label: "Choose from gallery",
        icon: "image-outline" as const,
        danger: false,
        action: () => {
          void onPickProfilePictureFromLibrary()
        },
      },
      ...(profilePictureUri
        ? [
            {
              key: "remove",
              label: "Remove photo",
              icon: "trash-outline" as const,
              danger: true,
              action: () => {
                void onRemoveProfilePicture()
              },
            },
          ]
        : []),
    ],
    [
      onPickProfilePictureFromLibrary,
      onRemoveProfilePicture,
      onTakeProfilePictureFromCamera,
      profilePictureUri,
    ],
  )

  const closePhotoMenu = (): void => {
    setPhotoMenuVisible(false)
  }

  const openPhotoActions = (): void => {
    avatarButtonRef.current?.measureInWindow((x, y, width, height) => {
      setPhotoMenuAnchor({ x, y, width, height })
      setPhotoMenuVisible(true)
    })
  }

  const menuWidth = Math.min(312, viewportWidth - 24)
  const estimatedMenuHeight = 92 + photoActions.length * 58
  const preferredTop = photoMenuAnchor ? photoMenuAnchor.y + photoMenuAnchor.height + 12 : 110
  const fallbackTop = photoMenuAnchor ? photoMenuAnchor.y - estimatedMenuHeight - 12 : 24
  const menuTop =
    photoMenuAnchor && preferredTop + estimatedMenuHeight > viewportHeight - 24
      ? Math.max(24, fallbackTop)
      : Math.max(24, preferredTop)
  const menuLeft = photoMenuAnchor
    ? Math.min(Math.max(16, photoMenuAnchor.x - 6), viewportWidth - menuWidth - 16)
    : 16

  return (
    <>
      <Modal
        transparent
        visible={photoMenuVisible}
        animationType="fade"
        onRequestClose={closePhotoMenu}
      >
        <View style={styles.photoMenuOverlay}>
          <Pressable style={styles.photoMenuDismissArea} onPress={closePhotoMenu} />
          <View style={[styles.photoMenuCard, { top: menuTop, left: menuLeft, width: menuWidth }]}>
            <BlurView intensity={68} tint="light" style={styles.photoMenuBlur}>
              <View style={styles.photoMenuPreviewRow}>
                <View style={styles.photoMenuPreviewAvatar}>
                  {profilePictureUri ? (
                    <Image
                      source={{
                        uri: profilePictureUri,
                        headers: accessToken
                          ? { Authorization: `Bearer ${accessToken}` }
                          : undefined,
                      }}
                      style={styles.photoMenuPreviewImage}
                    />
                  ) : (
                    <Text style={styles.photoMenuPreviewFallback}>{initials || "A"}</Text>
                  )}
                </View>
                <View style={styles.photoMenuPreviewCopy}>
                  <Text style={styles.photoMenuTitle}>Profile photo</Text>
                  <Text style={styles.photoMenuSubtitle}>
                    {profilePictureUri
                      ? "Update or remove the current avatar."
                      : "Choose how to add a profile photo."}
                  </Text>
                </View>
              </View>

              <View style={styles.photoMenuList}>
                {photoActions.map((item, index) => (
                  <View key={item.key}>
                    <Pressable
                      style={styles.photoMenuActionRow}
                      onPress={() => {
                        pendingPhotoActionRef.current = item.action
                        closePhotoMenu()
                      }}
                    >
                      <View
                        style={[
                          styles.photoMenuActionIconWrap,
                          item.danger ? styles.photoMenuActionIconWrapDanger : null,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={item.danger ? brandColors.terracotta : brandColors.forest}
                        />
                      </View>
                      <Text
                        style={[
                          styles.photoMenuActionLabel,
                          item.danger ? styles.photoMenuActionLabelDanger : null,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                    {index < photoActions.length - 1 ? (
                      <View style={styles.photoMenuSeparator} />
                    ) : null}
                  </View>
                ))}
              </View>
            </BlurView>
          </View>
        </View>
      </Modal>

      <View style={styles.screen}>
        <AppCard variant="panelElevated" padding={14} style={styles.accountSummaryCard}>
          <View style={styles.identityRow}>
            <Pressable
              ref={avatarButtonRef}
              style={styles.avatarHeroButton}
              onPress={openPhotoActions}
              disabled={profileUpdating}
            >
              {profilePictureUri ? (
                <Image
                  source={{
                    uri: profilePictureUri,
                    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
                  }}
                  style={styles.avatarHeroImage}
                />
              ) : (
                <View style={styles.avatarHeroFallback}>
                  <Text style={styles.avatarHeroFallbackText}>{initials || "A"}</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.identityCopy}>
              <Text style={styles.identityName}>{heroName}</Text>
              <Text style={styles.identityMeta}>{heroSubtitle}</Text>
              <View style={styles.heroChipRow}>
                <AppStatusChip label={roleLabel} />
              </View>
            </View>
          </View>

          <View style={styles.summaryFooterRow}>
            <AppButton
              label="Logout"
              leadingIcon="log-out-outline"
              variant="danger"
              onPress={() => void onLogout()}
              size="sm"
            />
          </View>
        </AppCard>

        <AppCard variant="panelElevated" padding={14} style={styles.panel}>
          <AppSectionHeader
            title="Profile fields"
            subtitle="Edit the synced identity shown across the app and shared survey data."
            trailing={
              isProfileDirty ? (
                <AppStatusChip label="Unsaved changes" tone="warning" />
              ) : (
                <AppStatusChip label="Up to date" tone="success" />
              )
            }
            titleStyle={styles.sectionTitle}
            subtitleStyle={styles.sectionBody}
          />

          <View style={styles.twoColumnRow}>
            <View style={styles.halfField}>
              <ProfileField
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Florian"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.halfField}>
              <ProfileField
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Lepont"
                autoCapitalize="words"
              />
            </View>
          </View>

          <ProfileField
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Field identity shown to others"
            autoCapitalize="words"
          />

          {emailEditing ? (
            <View style={styles.emailEditBlock}>
              <AppField
                label="New email"
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoFocus
                containerStyle={styles.fieldGroup}
                labelStyle={styles.fieldLabel}
                inputStyle={styles.fieldInput}
              />
              <View style={styles.emailEditActions}>
                <AppButton
                  label="Cancel"
                  variant="secondary"
                  size="sm"
                  onPress={() => { setEmailEditing(false); setNewEmail("") }}
                />
                <AppButton
                  label={profileUpdating ? "Saving..." : "Save email"}
                  size="sm"
                  disabled={profileUpdating || !newEmail.includes("@")}
                  onPress={() => void onChangeEmail(newEmail).then(() => { setEmailEditing(false); setNewEmail("") })}
                />
              </View>
            </View>
          ) : (
            <View style={styles.emailRow}>
              <View style={styles.emailInfo}>
                <Text style={styles.emailLabel}>Email</Text>
                <View style={styles.emailValueRow}>
                  <Ionicons name="lock-closed-outline" size={13} color={brandColors.textSecondary} />
                  <Text style={styles.emailValue}>{currentUser?.email ?? "—"}</Text>
                </View>
              </View>
              <Pressable onPress={() => { setNewEmail(currentUser?.email ?? ""); setEmailEditing(true) }}>
                <Text style={styles.emailManageLink}>Change →</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            style={styles.passwordRow}
            onPress={() => void Linking.openURL(AUTH0_RESET_PASSWORD_URL)}
          >
            <Ionicons name="key-outline" size={15} color={brandColors.forest} />
            <Text style={styles.passwordLink}>Change password</Text>
            <Ionicons name="open-outline" size={13} color={brandColors.textSecondary} />
          </Pressable>

          <AppButton
            label={profileUpdating ? "Saving profile..." : "Save profile"}
            leadingIcon={profileUpdating ? "hourglass-outline" : "save-outline"}
            onPress={() =>
              void onSaveProfile({
                first_name: firstName,
                last_name: lastName,
                display_name: displayName,
              })
            }
            disabled={profileUpdating || !isProfileDirty}
            size="lg"
          />
        </AppCard>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  screen: {
    gap: brandSpacing.md,
  },
  photoMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(24, 28, 23, 0.12)",
  },
  photoMenuDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  photoMenuCard: {
    position: "absolute",
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.72)",
    backgroundColor: "rgba(248, 242, 234, 0.78)",
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  photoMenuBlur: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  photoMenuPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  photoMenuPreviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.56)",
  },
  photoMenuPreviewImage: {
    width: "100%",
    height: "100%",
  },
  photoMenuPreviewFallback: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    color: brandColors.forest,
  },
  photoMenuPreviewCopy: {
    flex: 1,
    gap: 2,
  },
  photoMenuTitle: {
    ...brandTypography.label,
    fontSize: 14,
    lineHeight: 16,
    color: brandColors.textPrimary,
  },
  photoMenuSubtitle: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  photoMenuList: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.28)",
  },
  photoMenuActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  photoMenuActionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.52)",
  },
  photoMenuActionIconWrapDanger: {
    backgroundColor: "#F6E1D8",
  },
  photoMenuActionLabel: {
    flex: 1,
    ...brandTypography.sectionBody,
    fontSize: 17,
    lineHeight: 22,
    color: brandColors.textPrimary,
  },
  photoMenuActionLabelDanger: {
    color: brandColors.terracotta,
  },
  photoMenuSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
    backgroundColor: "rgba(62, 74, 54, 0.16)",
  },
  accountSummaryCard: {
    gap: 10,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarHeroButton: {
    width: 104,
    height: 104,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
  },
  avatarHeroImage: {
    width: "100%",
    height: "100%",
  },
  avatarHeroFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
  },
  avatarHeroFallbackText: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    color: brandColors.forest,
  },
  identityCopy: {
    flex: 1,
    gap: 6,
  },
  identityName: {
    ...brandTypography.sectionTitle,
    fontSize: 22,
    lineHeight: 24,
    color: brandColors.forest,
  },
  identityMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  heroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  summaryFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  panel: {
    gap: 10,
  },
  sectionTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 20,
    lineHeight: 22,
    color: brandColors.forest,
  },
  sectionBody: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  twoColumnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  halfField: {
    flex: 1,
    minWidth: 140,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  emailInfo: {
    flex: 1,
    gap: 4,
  },
  emailLabel: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  emailValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  emailValue: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  emailManageLink: {
    ...brandTypography.meta,
    color: brandColors.forest,
    fontWeight: "600",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  passwordLink: {
    flex: 1,
    ...brandTypography.sectionBody,
    color: brandColors.forest,
  },
  emailEditBlock: {
    gap: 10,
  },
  emailEditActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  fieldInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
})
