import { useEffect, useRef, useState } from "react"
import {
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
import * as Haptics from "expo-haptics"
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from "../app/auth0-config"
import {
  brandColors,
  brandRadius,
  brandSemanticColors,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppField } from "../ui/AppField"

type AuthGateScreenProps = {
  apiUrl: string
  onApiUrlChange: (value: string) => void
  onLogin: () => Promise<void>
  onRegister: () => Promise<void>
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
  const textOpacity = useRef(new Animated.Value(1)).current
  const cursorOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 530, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 530, useNativeDriver: true }),
      ]),
    )
    blink.start()
    return () => blink.stop()
  }, [cursorOpacity])

  const species = SPECIES_NAMES[idx]
  const spaceIdx = species.indexOf(" ")
  const genus = species.slice(0, spaceIdx)
  const epithet = species.slice(spaceIdx + 1)

  useEffect(() => {
    // While holding/fading, the animation callback drives the next transition.
    if (holding) return

    if (charsTyped < species.length) {
      const t = setTimeout(() => setCharsTyped((c) => c + 1), TYPE_CHAR_MS)
      return () => clearTimeout(t)
    }

    // All chars typed — hold then fade out.
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
  }, [charsTyped, holding, species, textOpacity])

  const genusTyped = species.slice(0, Math.min(charsTyped, spaceIdx))
  const epithetTyped = charsTyped > spaceIdx ? species.slice(spaceIdx + 1, charsTyped) : ""
  const cursorOnGenus = charsTyped <= spaceIdx

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
          <ActivityIndicator size="small" color={brandColors.white} style={{ opacity: 0.45 }} />
          <Animated.View style={{ opacity: textOpacity }}>
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
            {!cursorOnGenus && !holding ? (
              <Animated.Text style={[splashStyles.twCursor, { opacity: cursorOpacity }]}>
                |
              </Animated.Text>
            ) : null}
          </View>
          </Animated.View>
        </View>
      </View>
      <View style={[splashStyles.bottom, { paddingBottom: Math.max(insets.bottom, brandSpacing.lg) }]}>
        <Text style={splashStyles.tagline}>Chargement…</Text>
      </View>
    </View>
  )
}

// AUTH-13 : dimensions asset/layout extraites comme constantes nommées
const HERO_MIN_HEIGHT_RATIO = 0.35
const HERO_MIN_HEIGHT_PX = 280
const HERO_LOGO_WIDTH = 154
const HERO_LOGO_HEIGHT = 50
const HERO_LOGO_MARGIN_LEFT = -22
const HERO_LOGO_MARGIN_BOTTOM = brandSpacing.xs
const HERO_MARTEN_WIDTH = 168
const HERO_MARTEN_HEIGHT = 216
const HERO_MARTEN_RIGHT = 12
const HERO_MARTEN_BOTTOM = -14
const PANEL_OVERLAP = 24

// AUTH-11 : durées et décalages d'animation
const ANIM_HERO_DURATION = 200
const ANIM_LOGO_DURATION = 220
const ANIM_MARTEN_DURATION = 260
const ANIM_PANEL_DURATION = 300
const ANIM_STAGGER = 80

type HeroSectionProps = {
  height: number
  topInset: number
  logoSource?: ImageSourcePropType
  heroMartenSource?: ImageSourcePropType
  logoAnim: Animated.Value
  martenAnim: Animated.Value
}

function HeroSection({
  height,
  topInset,
  logoSource,
  heroMartenSource,
  logoAnim,
  martenAnim,
}: HeroSectionProps) {
  return (
    <View style={[authStyles.hero, { height }]}>
      {/* AUTH-02 : status bar claire sur le fond sombre */}
      <StatusBar barStyle="light-content" />
      <View style={[authStyles.heroBackground, { paddingTop: Math.max(topInset, 12) + 18 }]}>
        {/* AUTH-11 : martre en slide depuis la droite */}
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
        <View style={authStyles.heroContent}>
          {/* AUTH-11 : logo en slide depuis le haut */}
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
          {/* AUTH-03 : role header sur le titre */}
          <Text style={authStyles.heroTitle} accessibilityRole="header">
            Bienvenue sur l&apos;app IBP
          </Text>
          {/* AUTH-01 : couleur via token heroBodyOnDark */}
          <Text style={authStyles.heroBody}>
            un service proposé par{" "}
            <Text
              style={authStyles.heroLink}
              onPress={() => void Linking.openURL("https://etatssauvages.org")}
              accessibilityRole="link"
            >
              Etats Sauvages
            </Text>
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

  // AUTH-12 : masqué en production
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
        // AUTH-07 : zone tactile >= 44pt via hitSlop
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
          <Text style={authStyles.apiUrlPillEdit}>Modifier</Text>
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

  // AUTH-11 : valeurs d'animation
  const heroAnim = useRef(new Animated.Value(0)).current
  const logoAnim = useRef(new Animated.Value(0)).current
  const martenAnim = useRef(new Animated.Value(0)).current
  const panelAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: ANIM_HERO_DURATION,
        useNativeDriver: true,
      }),
      Animated.stagger(ANIM_STAGGER, [
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: ANIM_LOGO_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(martenAnim, {
          toValue: 1,
          duration: ANIM_MARTEN_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(panelAnim, {
          toValue: 1,
          duration: ANIM_PANEL_DURATION,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [heroAnim, logoAnim, martenAnim, panelAnim])

  const handleLoginPress = async (): Promise<void> => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      setSubmitting(true)
      await onLogin()
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegisterPress = async (): Promise<void> => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      setSubmitting(true)
      await onRegister()
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
    // AUTH-04 : behavior="padding" sur iOS (standard iOS HIG)
    <KeyboardAvoidingView
      style={authStyles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* AUTH-11 : hero en fadeIn */}
      <Animated.View style={{ opacity: heroAnim }}>
        <HeroSection
          height={heroHeight}
          topInset={insets.top}
          logoSource={logoSource}
          heroMartenSource={heroMartenSource}
          logoAnim={logoAnim}
          martenAnim={martenAnim}
        />
      </Animated.View>

      {/* AUTH-11 : panneau en slideUp + fade */}
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
        {/* AUTH-08 : ScrollView pour petits écrans avec clavier */}
        <ScrollView
          style={authStyles.panelScroll}
          contentContainerStyle={[
            authStyles.panelContent,
            { paddingBottom: Math.max(insets.bottom, brandSpacing.lg) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        >
          <View pointerEvents={submitting ? "none" : "auto"} style={authStyles.panelMain}>
            <View style={authStyles.panelHeader}>
              <Text style={authStyles.panelTitle} accessibilityRole="header">
                Connexion
              </Text>
              <Text style={authStyles.panelSubtitle}>
                Gérez vos relevés IBP, synchronisez vos données de terrain et consultez la carte de biodiversité.
              </Text>
            </View>

            {/* AUTH-06 : prop loading sur AppButton */}
            <AppButton
              label={submitting ? "Ouverture..." : "Se connecter"}
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
              testID="auth-register"
            />

            <Pressable
              onPress={() => void handleForgotPasswordPress()}
              style={authStyles.forgotPasswordLink}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              testID="auth-forgot-password"
            >
              <Text style={authStyles.forgotPasswordText}>Mot de passe oublié ?</Text>
            </Pressable>

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
            </View>
            <AuthPanelFooter apiUrl={apiUrl} onApiUrlChange={onApiUrlChange} />
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
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
    color: brandColors.white,
    letterSpacing: 2,
  },
  twEpithet: {
    fontSize: 16,
    fontStyle: "italic",
    fontWeight: "300",
    color: brandColors.white,
    opacity: 0.75,
    letterSpacing: 1.5,
  },
  twCursor: {
    fontSize: 18,
    fontWeight: "200",
    color: brandColors.white,
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
    // AUTH-13 : paddingBottom aligné sur brandSpacing.xl (28) + 2 = 30
    paddingBottom: brandSpacing.xl + 2,
    justifyContent: "flex-end",
  },
  heroContent: {
    zIndex: 1,
    width: "62%",
    alignItems: "flex-start",
    gap: brandSpacing.xs,
  },
  heroLogo: {
    width: HERO_LOGO_WIDTH,
    height: HERO_LOGO_HEIGHT,
    alignSelf: "flex-start",
    marginLeft: HERO_LOGO_MARGIN_LEFT,
    marginBottom: HERO_LOGO_MARGIN_BOTTOM,
  },
  heroTitle: {
    ...brandTypography.heroTitle,
    color: brandColors.white,
  },
  heroBody: {
    ...brandTypography.sectionBody,
    color: brandSemanticColors.heroBodyOnDark,
    maxWidth: 260,
  },
  heroLink: {
    color: brandColors.sage,
    textDecorationLine: "underline",
  },
  heroMarten: {
    position: "absolute",
    right: HERO_MARTEN_RIGHT,
    bottom: HERO_MARTEN_BOTTOM,
    width: HERO_MARTEN_WIDTH,
    height: HERO_MARTEN_HEIGHT,
    zIndex: 0,
  },
  panelWrap: {
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
    paddingHorizontal: brandSpacing.lg,
    paddingTop: brandSpacing.lg + 2,
    justifyContent: "space-between",
    gap: brandSpacing.lg,
  },
  panelMain: {
    gap: 14,
  },
  panelFooter: {
    gap: brandSpacing.sm,
    paddingTop: brandSpacing.sm,
  },
  panelHeader: {
    paddingTop: brandSpacing.xs,
    paddingBottom: brandSpacing.xs,
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
    marginTop: brandSpacing.xs + 2,
  },
  forgotPasswordLink: {
    alignSelf: "center",
    paddingVertical: 2,
  },
  forgotPasswordText: {
    ...brandTypography.meta,
    color: brandColors.forest,
    fontWeight: "600",
  },
  legalContainer: {
    alignItems: "center",
    paddingHorizontal: brandSpacing.sm,
  },
  legalText: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  legalLink: {
    color: brandColors.forest,
    fontWeight: "600",
  },
  panelFooterGroup: {
    gap: brandSpacing.sm,
    paddingTop: brandSpacing.sm,
  },
  apiUrlPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: brandColors.divider,
    borderRadius: brandRadius.pill,
    paddingVertical: brandSpacing.xs,
    paddingHorizontal: brandSpacing.sm + 2,
    gap: brandSpacing.xs,
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
    gap: brandSpacing.xs,
  },
  hint: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
})
