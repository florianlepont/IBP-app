import { useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from "../app/auth0-config"
import {
  brandColors,
  brandRadius,
  brandSemanticColors,
  brandShadow,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"
import { AppButton } from "../ui/AppButton"
import { AppField } from "../ui/AppField"
import { TypewriterSplash } from "../components/TypewriterSplash"

type AuthGateScreenProps = {
  apiUrl: string
  onApiUrlChange: (value: string) => void
  onLogin: () => Promise<string | null>
  onRegister: () => Promise<string | null>
  onForgotPassword: () => Promise<void>
  sessionRestoring?: boolean
  logoSource?: ImageSourcePropType
  heroMartenSource?: ImageSourcePropType
}

const HERO_MIN_HEIGHT_RATIO = 0.44
const HERO_MIN_HEIGHT_PX = 260
const HERO_LOGO_SIZE = 54
const HERO_MARTEN_WIDTH = 92
const HERO_MARTEN_HEIGHT = 207
const HERO_MARTEN_RIGHT = 34
const HERO_MARTEN_BOTTOM = 28
const HERO_FERNS_WIDTH = 485
const HERO_FERNS_HEIGHT = 400
const HERO_FERNS_RIGHT = HERO_MARTEN_RIGHT + HERO_MARTEN_WIDTH / 2 - HERO_FERNS_WIDTH / 2
const HERO_FERNS_BOTTOM = -Math.round(HERO_FERNS_HEIGHT * 0.3)
const PANEL_OVERLAP = 30

const BLOB_CYCLE_MS = 10000
const BLOB_STAGGER_MS = BLOB_CYCLE_MS / 3

function makeBlobExpandStyle(anim: Animated.Value, rotation: string): object {
  return {
    transform: [
      { rotate: rotation },
      {
        scale: anim.interpolate({
          inputRange: [0, 0.15, 1],
          outputRange: [0.3, 1.6, 14],
        }),
      },
    ],
    opacity: anim.interpolate({
      inputRange: [0, 0.06, 0.7, 1],
      outputRange: [0, 0.28, 0.07, 0],
    }),
  }
}

type HeroSectionProps = {
  height: number
  topInset: number
  leftInset: number
  logoSource?: ImageSourcePropType
  heroMartenSource?: ImageSourcePropType
  logoAnim: Animated.Value
  martenAnim: Animated.Value
  onLogoPress?: () => void
  reducedMotion: boolean
}

function HeroSection({
  height,
  topInset,
  leftInset,
  logoSource,
  heroMartenSource,
  logoAnim,
  martenAnim,
  onLogoPress,
  reducedMotion,
}: HeroSectionProps) {
  const { width: screenWidth } = useWindowDimensions()
  const heroContentMaxWidth = Math.min(screenWidth - brandSpacing.lg * 2, 270)

  const blob1Anim = useRef(new Animated.Value(0)).current
  const blob2Anim = useRef(new Animated.Value(0)).current
  const blob3Anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reducedMotion) return

    const animations: Animated.CompositeAnimation[] = []
    const timers: ReturnType<typeof setTimeout>[] = []

    ;[blob1Anim, blob2Anim, blob3Anim].forEach((anim, i) => {
      const t = setTimeout(() => {
        anim.setValue(0)
        const loop = Animated.loop(
          Animated.timing(anim, {
            toValue: 1,
            duration: BLOB_CYCLE_MS,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        )
        animations.push(loop)
        loop.start()
      }, i * BLOB_STAGGER_MS)
      timers.push(t)
    })

    return () => {
      timers.forEach(clearTimeout)
      animations.forEach((a) => a.stop())
    }
  }, [blob1Anim, blob2Anim, blob3Anim, reducedMotion])

  const logoImage = logoSource ? (
    <Animated.Image
      source={logoSource}
      style={[
        authStyles.heroLogo,
        {
          opacity: logoAnim,
          transform: [
            {
              translateY: logoAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-16, 0],
              }),
            },
          ],
        },
      ]}
      resizeMode="contain"
      accessible={false}
    />
  ) : null

  return (
    <View style={[authStyles.hero, { height }]}>
      <View style={authStyles.heroBackground}>
        <Image
          source={require("../../assets/auth/fougeres.png")}
          style={authStyles.heroFerns}
          resizeMode="contain"
          accessible={false}
        />

        {heroMartenSource ? (
          <Animated.Image
            source={heroMartenSource}
            style={[
              authStyles.heroMarten,
              {
                opacity: martenAnim,
                transform: [
                  {
                    translateX: martenAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                ],
              },
            ]}
            resizeMode="contain"
            accessible={false}
          />
        ) : null}

        <View
          style={[
            authStyles.heroContentWrapper,
            {
              paddingTop: Math.max(topInset, 12),
              paddingBottom: PANEL_OVERLAP + brandSpacing.md,
              paddingLeft: leftInset,
            },
          ]}
        >
          <View style={authStyles.logoBlobContainer}>
            <Animated.View
              style={[
                authStyles.heroBlob,
                authStyles.heroBlob1,
                makeBlobExpandStyle(blob1Anim, "-14deg"),
              ]}
            />
            <Animated.View
              style={[
                authStyles.heroBlob,
                authStyles.heroBlob2,
                makeBlobExpandStyle(blob2Anim, "22deg"),
              ]}
            />
            <Animated.View
              style={[
                authStyles.heroBlob,
                authStyles.heroBlob3,
                makeBlobExpandStyle(blob3Anim, "-4deg"),
              ]}
            />
            {onLogoPress ? (
              <Pressable onPress={onLogoPress} accessible={false}>
                {logoImage}
              </Pressable>
            ) : (
              logoImage
            )}
          </View>

          <View
            style={[authStyles.heroContent, { maxWidth: heroContentMaxWidth }]}
            accessible={true}
            accessibilityRole="header"
            accessibilityLabel="Indice de Biodiversité Potentielle, un service proposé par Etats Sauvages."
          >
            <Text style={authStyles.heroTitle}>Indice de{"\n"}Biodiversité Potentielle</Text>
            <Text style={authStyles.heroBody}>un service proposé par{"\n"}Etats Sauvages</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export function AuthGateScreen({
  apiUrl,
  onApiUrlChange,
  onLogin,
  onRegister,
  onForgotPassword,
  sessionRestoring,
  logoSource,
  heroMartenSource,
}: AuthGateScreenProps) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [submitting, setSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [showDevModal, setShowDevModal] = useState(false)

  const heroAnim = useRef(new Animated.Value(0)).current
  const logoAnim = useRef(new Animated.Value(0)).current
  const martenAnim = useRef(new Animated.Value(0)).current
  const panelAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion)
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      heroAnim.setValue(1)
      logoAnim.setValue(1)
      martenAnim.setValue(1)
      panelAnim.setValue(1)
      return
    }
    Animated.sequence([
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(martenAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(panelAnim, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [heroAnim, logoAnim, martenAnim, panelAnim, reducedMotion])

  const handleLoginPress = async (): Promise<void> => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      setSubmitting(true)
      setAuthError(null)
      const error = await onLogin()
      if (error) {
        setAuthError(error)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegisterPress = async (): Promise<void> => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      setSubmitting(true)
      setAuthError(null)
      const error = await onRegister()
      if (error) {
        setAuthError(error)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotPasswordPress = async (): Promise<void> => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await onForgotPassword()
  }

  const heroHeight = Math.max(Math.round(height * HERO_MIN_HEIGHT_RATIO), HERO_MIN_HEIGHT_PX)

  if (sessionRestoring) {
    return <TypewriterSplash logoSource={logoSource} />
  }

  return (
    <View style={authStyles.screen}>
      <StatusBar barStyle="light-content" />

      <Animated.View style={{ opacity: heroAnim }}>
        <HeroSection
          height={heroHeight}
          topInset={insets.top}
          leftInset={insets.left}
          logoSource={logoSource}
          heroMartenSource={heroMartenSource}
          logoAnim={logoAnim}
          martenAnim={martenAnim}
          onLogoPress={__DEV__ ? () => setShowDevModal(true) : undefined}
          reducedMotion={reducedMotion}
        />
      </Animated.View>

      <Animated.View
        style={[
          authStyles.panelWrap,
          {
            opacity: panelAnim,
            transform: [
              {
                translateY: panelAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [32, 0],
                }),
              },
            ],
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={authStyles.panelScroll}
            contentContainerStyle={[
              authStyles.panelContent,
              { paddingBottom: Math.max(insets.bottom, brandSpacing.lg) },
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
                  Connectez-vous ou créez un compte.{"\n"}Vos relevés restent disponibles
                  hors-ligne.
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
                  onPress={() => void handleLoginPress()}
                  loading={submitting}
                  style={authStyles.primaryButton}
                  testID="auth-submit"
                />

                <Pressable
                  onPress={() => void handleForgotPasswordPress()}
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
                  onPress={() => void handleRegisterPress()}
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
      </Animated.View>

      {__DEV__ ? (
        <Modal
          visible={showDevModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowDevModal(false)}
        >
          <View style={[devModalStyles.container, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={devModalStyles.header}>
              <Text style={devModalStyles.title}>Configuration dev</Text>
              <Pressable
                onPress={() => setShowDevModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Fermer"
              >
                <Ionicons name="close-circle" size={26} color={brandColors.textSecondary} />
              </Pressable>
            </View>
            <AppField
              label="URL de l'API"
              value={apiUrl}
              onChangeText={onApiUrlChange}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.x.x:3000/v1"
              testID="auth-api-url-input"
            />
            <Text style={devModalStyles.hint}>
              Simulateur iOS : localhost · Appareil physique : IP locale du Mac sur le même Wi-Fi
            </Text>
          </View>
        </Modal>
      ) : null}
    </View>
  )
}

const authStyles = StyleSheet.create({
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
  },
  heroContentWrapper: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  logoBlobContainer: {
    width: HERO_LOGO_SIZE,
    height: HERO_LOGO_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -14,
  },
  heroBlob: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0E2210",
  },
  heroBlob1: {
    borderTopLeftRadius: 55,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 60,
  },
  heroBlob2: {
    borderTopLeftRadius: 38,
    borderTopRightRadius: 62,
    borderBottomLeftRadius: 58,
    borderBottomRightRadius: 36,
  },
  heroBlob3: {
    borderTopLeftRadius: 48,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 66,
    borderBottomRightRadius: 52,
  },
  heroContent: {
    zIndex: 2,
    alignItems: "flex-start",
    gap: 8,
    marginTop: 24,
  },
  heroLogo: {
    width: HERO_LOGO_SIZE,
    height: HERO_LOGO_SIZE,
  },
  heroTitle: {
    ...brandTypography.heroTitle,
    fontSize: 28,
    lineHeight: 33,
    color: brandSemanticColors.heroBodyOnDark,
  },
  heroBody: {
    ...brandTypography.sectionBody,
    fontSize: 14,
    lineHeight: 20,
    color: brandSemanticColors.heroMetaOnDark,
  },
  heroFerns: {
    position: "absolute",
    right: HERO_FERNS_RIGHT,
    bottom: HERO_FERNS_BOTTOM,
    width: HERO_FERNS_WIDTH,
    height: HERO_FERNS_HEIGHT,
    opacity: 0.52,
    zIndex: 0,
  },
  heroMarten: {
    position: "absolute",
    right: HERO_MARTEN_RIGHT,
    bottom: HERO_MARTEN_BOTTOM,
    width: HERO_MARTEN_WIDTH,
    height: HERO_MARTEN_HEIGHT,
    zIndex: 1,
  },
  panelWrap: {
    ...brandShadow.card,
    flex: 1,
    marginTop: -PANEL_OVERLAP,
    borderTopLeftRadius: brandRadius.panel,
    borderTopRightRadius: brandRadius.panel,
    backgroundColor: brandColors.panel,
    zIndex: 2,
  },
  panelScroll: {
    flex: 1,
  },
  panelContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 44,
    gap: 16,
  },
  panelMain: {
    gap: 14,
  },
  panelHeader: {
    gap: 18,
    marginBottom: 18,
  },
  panelTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 25,
    lineHeight: 30,
    color: brandColors.textPrimary,
  },
  panelSubtitle: {
    ...brandTypography.sectionBody,
    fontSize: 14,
    lineHeight: 21,
    color: brandColors.textSecondary,
  },
  actionsGroup: {
    gap: 14,
  },
  primaryButton: {
    marginTop: 2,
    minHeight: 50,
  },
  secondaryButton: {
    minHeight: 44,
  },
  errorBanner: {
    backgroundColor: brandSemanticColors.errorSurface,
    borderRadius: brandRadius.card,
    paddingHorizontal: brandSpacing.md,
    paddingVertical: brandSpacing.sm,
  },
  errorBannerText: {
    ...brandTypography.meta,
    color: brandColors.terracotta,
    lineHeight: 17,
  },
  forgotPasswordLink: {
    alignSelf: "center",
    paddingTop: 0,
    marginTop: -6,
    paddingBottom: 6,
  },
  forgotPasswordText: {
    ...brandTypography.button,
    fontSize: 13,
    lineHeight: 17,
    color: brandColors.forest,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  legalContainer: {
    alignItems: "center",
    paddingHorizontal: brandSpacing.sm,
    paddingVertical: 6,
    gap: 14,
  },
  legalText: {
    ...brandTypography.meta,
    fontSize: 11,
    lineHeight: 16,
    color: brandColors.textSecondary,
    textAlign: "center",
    opacity: 0.9,
  },
  legalLink: {
    fontSize: 11,
    color: brandColors.forest,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  panelFooterGroup: {
    gap: 18,
    marginTop: "auto",
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: brandColors.divider,
  },
})

const devModalStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: brandSpacing.lg,
    paddingTop: 32,
    backgroundColor: brandColors.canvas,
    gap: brandSpacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: brandSpacing.sm,
  },
  title: {
    ...brandTypography.sectionTitle,
    fontSize: 18,
    color: brandColors.textPrimary,
  },
  hint: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
})
