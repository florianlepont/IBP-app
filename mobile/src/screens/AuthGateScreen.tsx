import { useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Linking,
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
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"

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

const SPECIES_NAMES = [
  "Fagus sylvatica",
  "Dryocopus martius",
  "Quercus robur",
  "Salamandra salamandra",
  "Betula pendula",
  "Sitta europaea",
  "Tilia cordata",
  "Martes martes",
  "Pinus sylvestris",
  "Parus major",
  "Carpinus betulus",
  "Rosalia alpina",
]

const TYPE_CHAR_MS = 68
const HOLD_MS = 900
const FADE_MS = 300

function TypewriterLoader({ logoSource }: { logoSource?: ImageSourcePropType }) {
  const insets = useSafeAreaInsets()
  const [idx, setIdx] = useState(0)
  const [charsTyped, setCharsTyped] = useState(0)
  const [holding, setHolding] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const textOpacity = useRef(new Animated.Value(1)).current
  const cursorOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion)
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 530, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 530, useNativeDriver: true }),
      ]),
    )
    blink.start()
    return () => blink.stop()
  }, [cursorOpacity, reducedMotion])

  const species = SPECIES_NAMES[idx]
  const spaceIdx = species.indexOf(" ")
  const genus = species.slice(0, spaceIdx)
  const epithet = species.slice(spaceIdx + 1)

  useEffect(() => {
    if (reducedMotion) return
    if (holding) return

    if (charsTyped < species.length) {
      const t = setTimeout(() => setCharsTyped((c) => c + 1), TYPE_CHAR_MS)
      return () => clearTimeout(t)
    }

    const t = setTimeout(() => {
      setHolding(true)
      Animated.timing(textOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(
        ({ finished }) => {
          if (!finished) return
          textOpacity.setValue(1)
          setCharsTyped(0)
          setHolding(false)
          setIdx((i) => (i + 1) % SPECIES_NAMES.length)
        },
      )
    }, HOLD_MS)
    return () => clearTimeout(t)
  }, [charsTyped, holding, reducedMotion, species, textOpacity])

  const genusTyped = reducedMotion ? genus : species.slice(0, Math.min(charsTyped, spaceIdx))
  const epithetTyped = reducedMotion ? epithet : charsTyped > spaceIdx ? species.slice(spaceIdx + 1, charsTyped) : ""
  const cursorOnGenus = !reducedMotion && charsTyped <= spaceIdx

  return (
    <View style={splashStyles.container}>
      <StatusBar barStyle="light-content" />
      <View style={[splashStyles.top, { paddingTop: Math.max(insets.top, 12) + 18 }]}>
        {logoSource ? (
          <Image source={logoSource} style={splashStyles.logo} resizeMode="contain" accessible={false} />
        ) : null}
      </View>
      <View style={splashStyles.stage}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <ActivityIndicator size="small" color={brandColors.white} style={{ opacity: 0.6 }} />
          <View
            accessible={true}
            accessibilityLabel="Chargement en cours"
            accessibilityLiveRegion="none"
          >
            <Animated.View style={{ opacity: textOpacity }} accessibilityElementsHidden={true}>
              <View style={splashStyles.twLine}>
                <Text style={splashStyles.twGenus}>{genusTyped}</Text>
                {cursorOnGenus ? (
                  <Animated.Text style={[splashStyles.twCursor, { opacity: cursorOpacity }]}>
                    |
                  </Animated.Text>
                ) : (
                  <Text style={splashStyles.twGenus}>{genus.slice(genusTyped.length)}</Text>
                )}
              </View>
              <View style={splashStyles.twLine}>
                <Text style={splashStyles.twEpithet}>{epithetTyped}</Text>
                {!cursorOnGenus && !holding && !reducedMotion ? (
                  <Animated.Text style={[splashStyles.twCursor, { opacity: cursorOpacity }]}>
                    |
                  </Animated.Text>
                ) : null}
              </View>
            </Animated.View>
          </View>
        </View>
      </View>
      <View style={[splashStyles.bottom, { paddingBottom: Math.max(insets.bottom, brandSpacing.lg) }]}>
        <Text style={splashStyles.tagline}>Chargement…</Text>
      </View>
    </View>
  )
}

const HERO_MIN_HEIGHT_RATIO = 0.44
const HERO_MIN_HEIGHT_PX = 260
const HERO_LOGO_SIZE = 54
const HERO_CONTENT_TOP_OFFSET = 42
const HERO_MARTEN_WIDTH = 92
const HERO_MARTEN_HEIGHT = 207
const HERO_MARTEN_RIGHT = 34
const HERO_MARTEN_BOTTOM = 28
const HERO_FERNS_WIDTH = 485
const HERO_FERNS_HEIGHT = 400
const HERO_FERNS_RIGHT = HERO_MARTEN_RIGHT + HERO_MARTEN_WIDTH / 2 - HERO_FERNS_WIDTH / 2
const HERO_FERNS_BOTTOM = -Math.round(HERO_FERNS_HEIGHT * 0.3)
const PANEL_OVERLAP = 30
const HERO_TEXT_RAISE = -Math.round(HERO_MIN_HEIGHT_PX * 0.1)

type HeroSectionProps = {
  height: number
  topInset: number
  leftInset: number
  logoSource?: ImageSourcePropType
  heroMartenSource?: ImageSourcePropType
  logoAnim: Animated.Value
  martenAnim: Animated.Value
}

function HeroSection({
  height,
  topInset,
  leftInset,
  logoSource,
  heroMartenSource,
  logoAnim,
  martenAnim,
}: HeroSectionProps) {
  const { width: screenWidth } = useWindowDimensions()
  const heroContentMaxWidth = Math.min(screenWidth - brandSpacing.lg * 2, 270)

  return (
    <View style={[authStyles.hero, { height }]}>
      <View style={authStyles.heroBackground}>
        {/* Fougères décoratives — base végétale derrière la martre */}
        <Image
          source={require("../../assets/auth/fougeres.png")}
          style={authStyles.heroFerns}
          resizeMode="contain"
          accessible={false}
        />

        {/* Marten — position absolute, clippé par overflow:hidden de heroBackground */}
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

        {/* Logo + texte centrés verticalement dans l'espace disponible */}
        <View
          style={[
            authStyles.heroContentWrapper,
            {
              paddingTop: Math.max(topInset, 12) + HERO_CONTENT_TOP_OFFSET,
              paddingBottom: PANEL_OVERLAP + brandSpacing.md,
              paddingLeft: leftInset,
            },
          ]}
        >
          {logoSource ? (
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
          ) : null}

          <View
            style={[authStyles.heroContent, { maxWidth: heroContentMaxWidth }]}
            accessible={true}
            accessibilityRole="header"
            accessibilityLabel="États Sauvages. Indice de Biodiversité Potentielle, un service proposé par Etats Sauvages."
          >
            <Text style={authStyles.heroEyebrow}>ÉTATS SAUVAGES</Text>
            <Text style={authStyles.heroTitle}>
              Indice de{"\n"}Biodiversité Potentielle
            </Text>
            <Text style={authStyles.heroBody}>
              un service proposé par{"\n"}Etats Sauvages
            </Text>
          </View>
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

  if (!__DEV__) return null

  return (
    <View style={authStyles.panelFooter}>
      {editing ? (
        <AppCard variant="soft" padding={14} style={authStyles.advancedPanel}>
          <AppField
            label="URL de l'API"
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
            Simulateur iOS : localhost · Appareil physique : IP locale du Mac sur le même Wi-Fi
          </Text>
        </AppCard>
      ) : (
        <Pressable
          onPress={() => setEditing(true)}
          style={authStyles.apiUrlPill}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Modifier l'URL de l'API"
          testID="auth-advanced-toggle"
        >
          <Text style={authStyles.apiUrlPillLabel}>API</Text>
          <Text style={authStyles.apiUrlPillValue} numberOfLines={1}>
            {apiUrl}
          </Text>
          <Ionicons name="create-outline" size={14} color={brandColors.forest} />
        </Pressable>
      )}
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
    Animated.stagger(60, [
      Animated.timing(heroAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(logoAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(martenAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(panelAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
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
    return <TypewriterLoader logoSource={logoSource} />
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
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
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
                onPress={() => void handleLoginPress()}
                loading={submitting}
                style={authStyles.primaryButton}
                testID="auth-submit"
              />
              <AppButton
                label="Créer un compte"
                variant="secondary"
                onPress={() => void handleRegisterPress()}
                disabled={submitting}
                style={authStyles.secondaryButton}
                testID="auth-register"
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
            </View>
          </View>

          <View style={authStyles.panelFooterGroup}>
            <View style={authStyles.legalContainer}>
              <Text style={authStyles.legalText}>
                En continuant, vous acceptez nos{" "}
                <Text
                  style={authStyles.legalLink}
                  onPress={() => void Linking.openURL(LEGAL_TERMS_URL)}
                  accessibilityRole="link"
                >
                  Conditions d&apos;utilisation
                </Text>
                {" "}et notre{" "}
                <Text
                  style={authStyles.legalLink}
                  onPress={() => void Linking.openURL(LEGAL_PRIVACY_URL)}
                  accessibilityRole="link"
                >
                  Politique de confidentialité
                </Text>
                .
              </Text>
              <Text style={authStyles.legalText}>
                <Text
                  style={authStyles.legalLink}
                  onPress={() => void Linking.openURL("https://etatssauvages.org")}
                  accessibilityRole="link"
                >
                  etatssauvages.org
                </Text>
              </Text>
            </View>
            <AuthPanelFooter apiUrl={apiUrl} onApiUrlChange={onApiUrlChange} />
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  )
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.forest,
  },
  top: {
    alignItems: "center",
    paddingTop: brandSpacing.lg,
  },
  logo: {
    width: 130,
    height: 42,
  },
  stage: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: brandSpacing.xl,
  },
  twLine: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  twGenus: {
    fontSize: 18,
    fontWeight: "500",
    color: brandSemanticColors.heroBodyOnDark,
    letterSpacing: 2,
  },
  twEpithet: {
    fontSize: 16,
    fontStyle: "italic",
    fontWeight: "300",
    color: brandSemanticColors.heroBodyOnDark,
    opacity: 0.75,
    letterSpacing: 1.5,
  },
  twCursor: {
    fontSize: 18,
    fontWeight: "200",
    color: brandSemanticColors.heroBodyOnDark,
    opacity: 0.9,
    marginLeft: 1,
  },
  bottom: {
    alignItems: "center",
    paddingBottom: brandSpacing.lg,
  },
  tagline: {
    ...brandTypography.meta,
    color: brandSemanticColors.heroBodyOnDark,
    opacity: 0.6,
  },
})

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
    justifyContent: "flex-start",
    gap: 42,
  },
  heroContent: {
    zIndex: 2,
    alignItems: "flex-start",
    gap: 12,
    transform: [{ translateY: HERO_TEXT_RAISE }],
  },
  heroLogo: {
    width: HERO_LOGO_SIZE,
    height: HERO_LOGO_SIZE,
  },
  heroEyebrow: {
    ...brandTypography.heroEyebrow,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 2.4,
    color: brandSemanticColors.heroMetaOnDark,
    marginBottom: 4,
  },
  heroTitle: {
    ...brandTypography.heroTitle,
    fontSize: 22,
    lineHeight: 27,
    color: brandSemanticColors.heroBodyOnDark,
  },
  heroBody: {
    ...brandTypography.sectionBody,
    fontSize: 14,
    lineHeight: 20,
    color: brandSemanticColors.heroMetaOnDark,
    opacity: 0.92,
    marginTop: 10,
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
  panelFooter: {
    gap: brandSpacing.sm,
    paddingTop: brandSpacing.sm,
  },
  panelHeader: {
    gap: 18,
    marginBottom: 18,
    marginTop: -8,
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
    transform: [{ translateY: -12 }],
  },
  primaryButton: {
    marginTop: 2,
    minHeight: 50,
  },
  secondaryButton: {
    minHeight: 50,
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
    paddingTop: 10,
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
    fontSize: 10,
    lineHeight: 15,
    color: brandColors.textSecondary,
    textAlign: "center",
    opacity: 0.9,
  },
  legalLink: {
    fontSize: 10,
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
    transform: [{ translateY: 6 }],
  },
  apiUrlPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: brandColors.divider,
    borderRadius: brandRadius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
    maxWidth: "100%",
    minHeight: 32,
  },
  apiUrlPillLabel: {
    ...brandTypography.meta,
    fontSize: 12,
    color: brandColors.textSecondary,
    fontWeight: "600",
    opacity: 0.75,
  },
  apiUrlPillValue: {
    ...brandTypography.meta,
    fontSize: 12,
    color: brandColors.textPrimary,
    opacity: 0.9,
    flex: 1,
  },
  advancedPanel: {
    gap: brandSpacing.xs,
  },
  hint: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
})
