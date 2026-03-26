import { useState } from "react"
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { brandColors, brandRadius, brandSpacing, brandTypography } from "../app/brand-tokens"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"

type AuthGateScreenProps = {
  apiUrl: string
  onApiUrlChange: (value: string) => void
  onLogin: () => Promise<void>
  status: string
  logoSource?: ImageSourcePropType
  heroMartenSource?: ImageSourcePropType
}

const HERO_MIN_HEIGHT_RATIO = 0.35
const HERO_MIN_HEIGHT_PX = 280

type HeroSectionProps = {
  height: number
  topInset: number
  logoSource?: ImageSourcePropType
  heroMartenSource?: ImageSourcePropType
}

function HeroSection({ height, topInset, logoSource, heroMartenSource }: HeroSectionProps) {
  return (
    <View style={[authStyles.hero, { height }]}>
      <View style={[authStyles.heroBackground, { paddingTop: Math.max(topInset, 12) + 18 }]}>
        {heroMartenSource ? (
          <Image source={heroMartenSource} style={authStyles.heroMarten} resizeMode="contain" />
        ) : null}
        <View style={authStyles.heroContent}>
          {logoSource ? (
            <Image source={logoSource} style={authStyles.heroLogo} resizeMode="contain" />
          ) : null}
          <Text style={authStyles.heroTitle}>Welcome to the IBP app</Text>
          <Text style={authStyles.heroBody}>
            Sign in or create an account to sync and manage your field surveys.
          </Text>
        </View>
      </View>
    </View>
  )
}

type AuthPanelFooterProps = {
  apiUrl: string
  onApiUrlChange: (value: string) => void
}

function AuthPanelFooter({ apiUrl, onApiUrlChange }: AuthPanelFooterProps) {
  const [editing, setEditing] = useState(false)

  return (
    <View style={authStyles.panelFooter}>
      {editing ? (
        <AppCard variant="soft" padding={14} style={authStyles.advancedPanel}>
          <AppField
            label="API URL"
            value={apiUrl}
            onChangeText={onApiUrlChange}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            placeholder="http://192.168.x.x:3000/v1"
            onBlur={() => setEditing(false)}
            testID="auth-api-url-input"
          />
          <Text style={authStyles.hint}>
            iOS Simulator: localhost · Physical device: Mac local IP on same Wi-Fi
          </Text>
        </AppCard>
      ) : (
        <Pressable
          onPress={() => setEditing(true)}
          style={authStyles.apiUrlPill}
          testID="auth-advanced-toggle"
        >
          <Text style={authStyles.apiUrlPillLabel}>API</Text>
          <Text style={authStyles.apiUrlPillValue} numberOfLines={1}>
            {apiUrl}
          </Text>
          <Text style={authStyles.apiUrlPillEdit}>Edit</Text>
        </Pressable>
      )}
    </View>
  )
}

export function AuthGateScreen({
  apiUrl,
  onApiUrlChange,
  onLogin,
  status,
  logoSource,
  heroMartenSource,
}: AuthGateScreenProps) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [submitting, setSubmitting] = useState(false)

  const normalizedStatus = status.trim().toLowerCase()
  const feedbackMessage =
    normalizedStatus && !normalizedStatus.includes("logged in") ? status : ""
  const feedbackTone: "error" | "status" =
    normalizedStatus.includes("error") || normalizedStatus.includes("failed") ? "error" : "status"

  const handleLogin = async (): Promise<void> => {
    try {
      setSubmitting(true)
      await onLogin()
    } finally {
      setSubmitting(false)
    }
  }

  const heroHeight = Math.max(Math.round(height * HERO_MIN_HEIGHT_RATIO), HERO_MIN_HEIGHT_PX)

  return (
    <ScrollView
      style={authStyles.screen}
      contentContainerStyle={authStyles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <HeroSection
        height={heroHeight}
        topInset={insets.top}
        logoSource={logoSource}
        heroMartenSource={heroMartenSource}
      />

      <View style={authStyles.panelWrap}>
        <View style={authStyles.panelContent}>
          <View style={authStyles.panelMain}>
            <View style={authStyles.panelHeader}>
              <Text style={authStyles.panelTitle}>Sign in</Text>
              <Text style={authStyles.panelSubtitle}>
                Access your surveys, public map, and account settings.
              </Text>
            </View>

            <AppButton
              label={submitting ? "Opening..." : "Sign in / Create account"}
              onPress={() => void handleLogin()}
              disabled={submitting}
              style={authStyles.primaryButton}
              testID="auth-submit"
            />

            {feedbackMessage ? (
              <Text style={feedbackTone === "error" ? authStyles.errorText : authStyles.statusText}>
                {feedbackMessage}
              </Text>
            ) : null}
          </View>

          <AuthPanelFooter apiUrl={apiUrl} onApiUrlChange={onApiUrlChange} />
        </View>
      </View>
    </ScrollView>
  )
}

const authStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  screenContent: {
    flexGrow: 1,
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
    width: "62%",
    alignItems: "flex-start",
    gap: 8,
  },
  heroLogo: {
    width: 154,
    height: 50,
    alignSelf: "flex-start",
    marginLeft: -22,
    marginBottom: 6,
  },
  heroTitle: {
    ...brandTypography.heroTitle,
    color: brandColors.white,
  },
  heroBody: {
    ...brandTypography.sectionBody,
    color: "#E8ECD9",
    maxWidth: 260,
  },
  heroMarten: {
    position: "absolute",
    right: 12,
    bottom: -14,
    width: 168,
    height: 216,
    zIndex: 0,
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
    paddingTop: 18,
    paddingBottom: 20,
    justifyContent: "space-between",
  },
  panelMain: {
    gap: 14,
  },
  panelFooter: {
    gap: 10,
    paddingTop: 10,
  },
  panelHeader: {
    minHeight: 88,
    paddingTop: 6,
    justifyContent: "center",
    gap: 4,
  },
  panelTitle: {
    ...brandTypography.sectionTitle,
    color: brandColors.textPrimary,
  },
  panelSubtitle: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  primaryButton: {
    marginTop: 8,
  },
  apiUrlPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: brandColors.divider,
    borderRadius: brandRadius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
    maxWidth: "100%",
  },
  apiUrlPillLabel: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
    fontWeight: "600",
  },
  apiUrlPillValue: {
    ...brandTypography.meta,
    color: brandColors.textPrimary,
    flex: 1,
  },
  apiUrlPillEdit: {
    ...brandTypography.meta,
    color: brandColors.forest,
    fontWeight: "600",
  },
  advancedPanel: {
    gap: 6,
  },
  hint: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  errorText: {
    borderRadius: 16,
    backgroundColor: brandColors.errorSoft,
    color: "#6B2E1C",
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...brandTypography.sectionBody,
  },
  statusText: {
    borderRadius: 16,
    backgroundColor: brandColors.successSoft,
    color: brandColors.forest,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...brandTypography.sectionBody,
  },
})
