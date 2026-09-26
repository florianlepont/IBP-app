import { useEffect, useRef } from "react"
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { brandSpacing } from "../../app/brand-tokens"
import { fr } from "../../i18n"
import { authStyles, PANEL_OVERLAP } from "./styles"

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

export type HeroSectionProps = {
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

export function HeroSection({
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
          source={require("../../../assets/auth/fougeres.png")}
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
              <Pressable
                onPress={onLogoPress}
                accessible={false}
                accessibilityRole="button"
                accessibilityLabel={fr.authGate.hero.devConfigA11yLabel}
              >
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
            accessibilityLabel={fr.authGate.hero.a11yLabel}
          >
            <Text style={authStyles.heroTitle}>{fr.authGate.hero.title}</Text>
            <Text style={authStyles.heroBody}>{fr.authGate.hero.subtitle}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
