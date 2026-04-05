import { useState } from "react"
import {
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  brandColors,
  brandRadius,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"
import { AppButton } from "../ui/AppButton"
import { AppField } from "../ui/AppField"

type ProfileSetupScreenProps = {
  saving: boolean
  logoSource?: ImageSourcePropType
  onSave: (firstName: string, lastName: string) => Promise<void>
  onSkip: () => void
}

const HERO_MIN_HEIGHT_RATIO = 0.35
const HERO_MIN_HEIGHT_PX = 260

function HeroSection({
  height,
  topInset,
  logoSource,
}: {
  height: number
  topInset: number
  logoSource?: ImageSourcePropType
}) {
  return (
    <View style={[styles.hero, { height }]}>
      <View style={[styles.heroBackground, { paddingTop: Math.max(topInset, 12) + 18 }]}>
        <View style={styles.heroContent}>
          {logoSource ? (
            <Image source={logoSource} style={styles.heroLogo} resizeMode="contain" />
          ) : null}
          <Text style={styles.heroEyebrow}>NEW ACCOUNT</Text>
          <Text style={styles.heroTitle}>Almost there!</Text>
          <Text style={styles.heroBody}>
            Tell us your name so other contributors can recognise you in the community.
          </Text>
        </View>
        <View style={styles.heroBump} />
      </View>
    </View>
  )
}

export function ProfileSetupScreen({
  saving,
  logoSource,
  onSave,
  onSkip,
}: ProfileSetupScreenProps) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")

  const heroHeight = Math.max(Math.round(height * HERO_MIN_HEIGHT_RATIO), HERO_MIN_HEIGHT_PX)

  const handleContinue = async (): Promise<void> => {
    await onSave(firstName.trim(), lastName.trim())
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <HeroSection height={heroHeight} topInset={insets.top} logoSource={logoSource} />

      <View style={styles.panelWrap}>
        <View style={styles.panelContent}>
          <View style={styles.panelMain}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Your name</Text>
              <Text style={styles.panelSubtitle}>
                Visible to other contributors. You can update it later in your profile.
              </Text>
            </View>

            <View style={styles.fields}>
              <AppField
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="e.g. Marie"
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                returnKeyType="next"
              />
              <AppField
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="e.g. Dupont"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (firstName.trim()) void handleContinue()
                }}
              />
            </View>

            <AppButton
              label={saving ? "Saving..." : "Get started"}
              onPress={() => void handleContinue()}
              disabled={saving || !firstName.trim()}
              size="lg"
              style={styles.primaryButton}
            />

            <Pressable onPress={onSkip} hitSlop={12} style={styles.skipWrapper}>
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  hero: {
    width: "100%",
  },
  heroBackground: {
    flex: 1,
    backgroundColor: brandColors.forest,
    overflow: "hidden",
    paddingHorizontal: brandSpacing.lg,
    paddingBottom: 30,
    justifyContent: "flex-end",
  },
  heroContent: {
    zIndex: 1,
    alignItems: "flex-start",
    gap: 6,
  },
  heroLogo: {
    width: 154,
    height: 50,
    alignSelf: "flex-start",
    marginLeft: -22,
    marginBottom: 8,
  },
  heroEyebrow: {
    ...brandTypography.heroEyebrow,
    color: brandColors.sage,
    letterSpacing: 1.8,
  },
  heroTitle: {
    ...brandTypography.heroTitle,
    color: brandColors.white,
  },
  heroBody: {
    ...brandTypography.sectionBody,
    color: "#E8ECD9",
    maxWidth: 280,
    marginTop: 2,
  },
  heroBump: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "55%",
    height: 6,
    backgroundColor: brandColors.moss,
    borderTopRightRadius: brandRadius.pill,
  },
  panelWrap: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: brandRadius.panel,
    borderTopRightRadius: brandRadius.panel,
    backgroundColor: brandColors.panel,
    zIndex: 2,
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
  },
  panelMain: {
    gap: 16,
  },
  panelHeader: {
    gap: 4,
    paddingTop: 2,
    marginBottom: 4,
  },
  panelTitle: {
    ...brandTypography.sectionTitle,
    color: brandColors.textPrimary,
  },
  panelSubtitle: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  fields: {
    gap: 12,
  },
  primaryButton: {
    marginTop: 4,
  },
  skipWrapper: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  skipText: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
    textDecorationLine: "underline",
  },
})
