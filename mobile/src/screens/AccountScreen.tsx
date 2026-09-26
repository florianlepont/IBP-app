import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Platform, ScrollView, View } from "react-native"
import { useHeaderHeight } from "@react-navigation/elements"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { brandColors, brandSpacing } from "../app/brand-tokens"
import { AuthUser } from "../app/types"
import { useAppBottomTabBarHeight } from "../app/useAppBottomTabBarHeight"
import { AccountSettingsRows, LogoutButton } from "./account/AccountSettingsRows"
import { IdentityCard } from "./account/IdentityCard"
import { ProfileCard } from "./account/ProfileCard"
import { accountStyles as styles } from "./account/styles"

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

  useEffect(() => {
    setFirstName(currentUser?.first_name ?? "")
    setLastName(currentUser?.last_name ?? "")
    setDisplayName(currentUser?.display_name ?? "")
  }, [currentUser])

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
  // Keep header/tab bar clearance inside the scroll content so it scrolls away naturally.
  const topContentPadding = Platform.OS === "ios" ? headerHeight + brandSpacing.md : brandSpacing.md
  const bottomContentPadding = Math.max(tabBarHeight, insets.bottom) + brandSpacing.md

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
      <IdentityCard
        accessToken={accessToken}
        apiUrl={apiUrl}
        currentUser={currentUser}
        profile={profile}
        heroName={heroName}
        profileUpdating={profileUpdating}
        onPickProfilePictureFromLibrary={onPickProfilePictureFromLibrary}
        onTakeProfilePictureFromCamera={onTakeProfilePictureFromCamera}
        onRemoveProfilePicture={onRemoveProfilePicture}
      />

      <ProfileCard
        firstName={firstName}
        lastName={lastName}
        displayName={displayName}
        onFirstNameChange={setFirstName}
        onLastNameChange={setLastName}
        onDisplayNameChange={setDisplayName}
        isProfileDirty={isProfileDirty}
        profileUpdating={profileUpdating}
        onSave={() =>
          void onSaveProfile({
            first_name: firstName,
            last_name: lastName,
            display_name: displayName,
          })
        }
      >
        <AccountSettingsRows
          currentUser={currentUser}
          profileUpdating={profileUpdating}
          onChangeEmail={onChangeEmail}
          onPasswordReset={onPasswordReset}
        />
      </ProfileCard>

      <LogoutButton onLogout={onLogout} />
    </ScrollView>
  )
}
