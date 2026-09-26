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
import { AppButton } from "../../ui/AppButton"
import { authStyles } from "./styles"

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
              Bienvenue
            </Text>
            <Text style={authStyles.panelSubtitle}>
              Connectez-vous ou créez un compte.{"\n"}Vos relevés restent disponibles hors-ligne.
            </Text>
          </View>

          {authError !== null && (
            <View style={authStyles.errorBanner}>
              <Text style={authStyles.errorBannerText}>{authError}</Text>
            </View>
          )}

          <View style={authStyles.actionsGroup}>
            <AppButton
              label={submitting ? "Connexion en cours…" : "Se connecter"}
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
              testID="auth-forgot-password"
            >
              <Text style={authStyles.forgotPasswordText}>Mot de passe oublié ?</Text>
            </Pressable>

            <AppButton
              label="Créer un compte"
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
              En continuant, vous acceptez nos{" "}
              <Text
                style={authStyles.legalLink}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  void Linking.openURL(LEGAL_TERMS_URL)
                }}
                accessibilityRole="link"
              >
                Conditions d&apos;utilisation
              </Text>{" "}
              et notre{" "}
              <Text
                style={authStyles.legalLink}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  void Linking.openURL(LEGAL_PRIVACY_URL)
                }}
                accessibilityRole="link"
              >
                Politique de confidentialité
              </Text>
              .
            </Text>
            <Text style={authStyles.legalText}>
              <Text
                style={authStyles.legalLink}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  void Linking.openURL("https://etatssauvages.org")
                }}
                accessibilityRole="link"
              >
                etatssauvages.org
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
