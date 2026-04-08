import { useEffect, useRef, useState } from "react"
import {
  Animated,
  ImageSourcePropType,
  KeyboardAvoidingView,
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
import { AppNotice } from "../ui/AppNotice"

type AuthGateScreenProps = {
  apiUrl: string
  onApiUrlChange: (value: string) => void
  onLogin: () => Promise<void>
  status: string
  logoSource?: ImageSourcePropType
  heroMartenSource?: ImageSourcePropType
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
            Connectez-vous pour synchroniser et gérer vos relevés de terrain.
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
  status,
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

  const normalizedStatus = status.trim().toLowerCase()
  const feedbackMessage = normalizedStatus && !normalizedStatus.includes("logged in") ? status : ""
  const feedbackIndicatesError = [
    "error",
    "failed",
    "unauthorized",
    "forbidden",
    "denied",
    "refuse",
    "refus",
  ].some((pattern) => normalizedStatus.includes(pattern))
  const feedbackTone: "danger" | "success" = feedbackIndicatesError ? "danger" : "success"

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
        >
          <View style={authStyles.panelMain}>
            <View style={authStyles.panelHeader}>
              {/* AUTH-03 : role header sur le titre du panneau */}
              <Text style={authStyles.panelTitle} accessibilityRole="header">
                Connexion
              </Text>
              <Text style={authStyles.panelSubtitle}>
                Accédez à vos relevés, la carte publique et votre compte.
              </Text>
            </View>

            {/* AUTH-06 : prop loading sur AppButton */}
            <AppButton
              label={submitting ? "Ouverture..." : "Se connecter / Créer un compte"}
              onPress={() => void handleLogin()}
              loading={submitting}
              style={authStyles.primaryButton}
              testID="auth-submit"
            />

            {feedbackMessage ? (
              <AppNotice
                tone={feedbackTone}
                icon={
                  feedbackTone === "danger" ? "alert-circle-outline" : "information-circle-outline"
                }
                title={feedbackTone === "danger" ? "Problème de connexion" : "Statut"}
                message={feedbackMessage}
              />
            ) : null}
          </View>

          <AuthPanelFooter apiUrl={apiUrl} onApiUrlChange={onApiUrlChange} />
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
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
    // AUTH-01 : token sémantique au lieu de #E8ECD9 hardcodé
    color: brandSemanticColors.heroBodyOnDark,
    maxWidth: 260,
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
    minHeight: 88,
    paddingTop: brandSpacing.xs,
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
    marginTop: brandSpacing.xs + 2,
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
