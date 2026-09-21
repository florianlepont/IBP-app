import { useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  ImageSourcePropType,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  brandColors,
  brandSemanticColors,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"

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

export function TypewriterSplash({ logoSource }: { logoSource?: ImageSourcePropType }) {
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
  const epithetTyped = reducedMotion
    ? epithet
    : charsTyped > spaceIdx
      ? species.slice(spaceIdx + 1, charsTyped)
      : ""
  const cursorOnGenus = !reducedMotion && charsTyped <= spaceIdx

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 12) + 18 }]}>
        {logoSource ? (
          <Image source={logoSource} style={styles.logo} resizeMode="contain" accessible={false} />
        ) : null}
      </View>
      <View style={styles.stage}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <ActivityIndicator size="small" color={brandColors.white} style={{ opacity: 0.6 }} />
          <View
            accessible={true}
            accessibilityLabel="Chargement en cours"
            accessibilityLiveRegion="none"
          >
            <Animated.View style={{ opacity: textOpacity }} accessibilityElementsHidden={true}>
              <View style={styles.twLine}>
                <Text style={styles.twGenus}>{genusTyped}</Text>
                {cursorOnGenus ? (
                  <Animated.Text style={[styles.twCursor, { opacity: cursorOpacity }]}>
                    |
                  </Animated.Text>
                ) : (
                  <Text style={styles.twGenus}>{genus.slice(genusTyped.length)}</Text>
                )}
              </View>
              <View style={styles.twLine}>
                <Text style={styles.twEpithet}>{epithetTyped}</Text>
                {!cursorOnGenus && !holding && !reducedMotion ? (
                  <Animated.Text style={[styles.twCursor, { opacity: cursorOpacity }]}>
                    |
                  </Animated.Text>
                ) : null}
              </View>
            </Animated.View>
          </View>
        </View>
      </View>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, brandSpacing.lg) }]}>
        <Text style={styles.tagline}>Chargement…</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
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
    opacity: 0.75,
  },
})
