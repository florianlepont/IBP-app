import { useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageSourcePropType,
  Modal,
  Pressable,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { brandColors } from "../app/brand-tokens"
import { AppField } from "../ui/AppField"
import { TypewriterSplash } from "../components/TypewriterSplash"
import { AuthPanel } from "./auth-gate/AuthPanel"
import { HeroSection } from "./auth-gate/HeroSection"
import {
  authStyles,
  devModalStyles,
  HERO_MIN_HEIGHT_PX,
  HERO_MIN_HEIGHT_RATIO,
} from "./auth-gate/styles"

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
        <AuthPanel
          submitting={submitting}
          authError={authError}
          bottomInset={insets.bottom}
          onLoginPress={() => void handleLoginPress()}
          onRegisterPress={() => void handleRegisterPress()}
          onForgotPasswordPress={() => void handleForgotPasswordPress()}
        />
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
