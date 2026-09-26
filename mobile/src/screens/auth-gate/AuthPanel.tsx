import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native"
import * as Haptics from "expo-haptics"
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from "../../app/auth0-config"
import { brandSpacing } from "../../app/brand-tokens"
import { fr } from "../../i18n"
import { AppButton } from "../../ui/AppButton"
import { authStyles } from "./styles"

const WEBSITE_URL = "https://etatssauvages.org"
const texts = fr.authGate

const openLink = (url: string): void => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  void Linking.openURL(url)
}

export type AuthPanelProps = {
  submitting: boolean
  authError: string | null
  bottomInset: number
  onLoginPress: () => void
  onRegisterPress: () => void
  onForgotPasswordPress: () => void
}

// Sign-in / register panel below the hero: title, error banner, the three
// actions and the legal footer.
export function AuthPanel({
  submitting,
  authError,
  bottomInset,
  onLoginPress,
  onRegisterPress,
  onForgotPasswordPress,
}: AuthPanelProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={authStyles.panelScroll}
        contentContainerStyle={[
          authStyles.panelContent,
          { paddingBottom: Math.max(bottomInset, brandSpacing.lg) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View pointerEvents={submitting ? "none" : "auto"} style={authStyles.panelMain}>
          <View style={authStyles.panelHeader}>
            <Text style={authStyles.panelTitle} accessibilityRole="header">
              {texts.panel.title}
            </Text>
            <Text style={authStyles.panelSubtitle}>{texts.panel.subtitle}</Text>
          </View>

          {authError !== null && (
            <View style={authStyles.errorBanner}>
              <Text style={authStyles.errorBannerText}>{authError}</Text>
            </View>
          )}

          <View style={authStyles.actionsGroup}>
            <AppButton
              label={submitting ? texts.panel.loginInProgress : texts.panel.login}
              onPress={onLoginPress}
              loading={submitting}
              style={authStyles.primaryButton}
              testID="auth-submit"
            />

            <Pressable
              onPress={onForgotPasswordPress}
              style={authStyles.forgotPasswordLink}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="link"
              accessibilityLabel={texts.panel.forgotPassword}
              testID="auth-forgot-password"
            >
              <Text style={authStyles.forgotPasswordText}>{texts.panel.forgotPassword}</Text>
            </Pressable>

            <AppButton
              label={texts.panel.register}
              variant="secondary"
              onPress={onRegisterPress}
              disabled={submitting}
              style={authStyles.secondaryButton}
              testID="auth-register"
            />
          </View>
        </View>

        <View style={authStyles.panelFooterGroup}>
          <View style={authStyles.legalContainer}>
            <Text style={authStyles.legalText}>
              {texts.legal.prefix}{" "}
              <Text
                style={authStyles.legalLink}
                onPress={() => openLink(LEGAL_TERMS_URL)}
                accessibilityRole="link"
              >
                {texts.legal.terms}
              </Text>{" "}
              {texts.legal.and}{" "}
              <Text
                style={authStyles.legalLink}
                onPress={() => openLink(LEGAL_PRIVACY_URL)}
                accessibilityRole="link"
              >
                {texts.legal.privacy}
              </Text>
              {texts.legal.suffix}
            </Text>
            <Text style={authStyles.legalText}>
              <Text
                style={authStyles.legalLink}
                onPress={() => openLink(WEBSITE_URL)}
                accessibilityRole="link"
              >
                {texts.legal.website}
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
