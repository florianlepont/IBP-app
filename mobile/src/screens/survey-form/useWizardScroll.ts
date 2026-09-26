import { useCallback, useEffect, useRef, useState } from "react"
import {
  Animated,
  Keyboard,
  LayoutRectangle,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  useWindowDimensions,
} from "react-native"
import { useHeaderHeight } from "@react-navigation/elements"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { brandSpacing } from "../../app/brand-tokens"
import { useAppBottomTabBarHeight } from "../../app/useAppBottomTabBarHeight"
import type { WizardStep } from "./components"

const COLLAPSED_HERO_HEIGHT = 84

const clampInterpolation = (
  value: Animated.Value,
  inputRange: number[],
  outputRange: number[],
): Animated.AnimatedInterpolation<number> =>
  value.interpolate({ inputRange, outputRange, extrapolate: "clamp" })

// Scroll, keyboard and collapsing-hero behaviour of the survey wizard.
export function useWizardScroll(activeStep: WizardStep, setActiveStep: (step: WizardStep) => void) {
  const scrollRef = useRef<ScrollView | null>(null)
  const scrollOffsetRef = useRef(0)
  const identityScrollBeforeFocusRef = useRef(0)
  const identitySectionLayoutRef = useRef({ y: 0, height: 0 })
  const scrollY = useRef(new Animated.Value(0)).current
  const { height: viewportHeight } = useWindowDimensions()
  const tabBarHeight = useAppBottomTabBarHeight()
  const headerHeight = useHeaderHeight()
  const insets = useSafeAreaInsets()
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [isIdentityInputFocused, setIsIdentityInputFocused] = useState(false)

  const scrollWizardTo = useCallback((y: number, animated = true): void => {
    scrollRef.current?.scrollTo?.({ y, animated })
  }, [])

  const heroTopOffset = Math.max(headerHeight - insets.top, 0) + 42
  const expandedHeroHeight = Math.max(248, Math.min(292, Math.round(viewportHeight * 0.27)))
  const collapseDistance = expandedHeroHeight - COLLAPSED_HERO_HEIGHT
  const topSpacerHeight = heroTopOffset + expandedHeroHeight + brandSpacing.xs
  const minimumTabBarHeight = Platform.select({ ios: 84, default: 68 }) ?? 68
  const bottomActionClearance = Math.max(tabBarHeight, minimumTabBarHeight) + brandSpacing.xs
  const scrollContentBottomPadding =
    keyboardHeight > 0 ? keyboardHeight + 72 : bottomActionClearance
  const scrollIdentitySectionAboveKeyboard = useCallback(
    (keyboardFrameHeight = keyboardHeight): void => {
      const visibleTop = heroTopOffset + COLLAPSED_HERO_HEIGHT + brandSpacing.md
      const visibleBottom = viewportHeight - keyboardFrameHeight - brandSpacing.lg
      const { y, height } = identitySectionLayoutRef.current
      const targetY = Math.max(y - visibleTop, y + height - visibleBottom, 0)
      scrollWizardTo(targetY)
    },
    [heroTopOffset, keyboardHeight, scrollWizardTo, viewportHeight],
  )

  const d = collapseDistance
  const animation = {
    heroHeight: clampInterpolation(scrollY, [0, d], [expandedHeroHeight, COLLAPSED_HERO_HEIGHT]),
    expandedOpacity: clampInterpolation(scrollY, [0, d * 0.36, d * 0.62], [1, 0.22, 0]),
    expandedTranslateY: clampInterpolation(scrollY, [0, d * 0.62], [0, -10]),
    compactOpacity: clampInterpolation(scrollY, [d * 0.42, d * 0.72, d], [0, 0.65, 1]),
    compactTranslateY: clampInterpolation(scrollY, [d * 0.42, d], [8, 0]),
    stepRailOpacity: clampInterpolation(scrollY, [0, 36, 88], [1, 0.45, 0]),
    stepRailScale: clampInterpolation(scrollY, [0, 88], [1, 0.92]),
    stepRailTranslateY: clampInterpolation(scrollY, [0, 88], [0, -18]),
    stepRailHeight: clampInterpolation(scrollY, [0, 88], [114, 0]),
    compactProgressOpacity: clampInterpolation(scrollY, [d * 0.38, d * 0.68, d], [0, 0.55, 1]),
  }

  const identityEditing = isIdentityInputFocused || keyboardHeight > 0
  const preserveIdentityRailSpace = activeStep === "identity" && identityEditing

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const nextKeyboardHeight = event.endCoordinates.height
      setKeyboardHeight(nextKeyboardHeight)

      if (activeStep === "identity" && isIdentityInputFocused) {
        setTimeout(() => {
          scrollIdentitySectionAboveKeyboard(nextKeyboardHeight)
        }, 40)
      }
    })
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0)
    })

    return () => {
      showSubscription.remove()
      hideSubscription.remove()
    }
  }, [activeStep, isIdentityInputFocused, scrollIdentitySectionAboveKeyboard])

  const openWizardStep = (nextStep: WizardStep): void => {
    const baseOffset =
      activeStep === "identity" && (keyboardHeight > 0 || isIdentityInputFocused)
        ? identityScrollBeforeFocusRef.current
        : scrollOffsetRef.current
    const targetOffset =
      nextStep === "identity" || (activeStep === "parcels" && nextStep === "factors")
        ? 0
        : Math.max(baseOffset, collapseDistance)

    setIsIdentityInputFocused(false)
    Keyboard.dismiss()
    setActiveStep(nextStep)
    setTimeout(() => {
      scrollY.setValue(targetOffset)
      scrollWizardTo(targetOffset, false)
    }, 0)
  }

  useEffect(() => {
    if (activeStep === "identity" && keyboardHeight === 0 && !isIdentityInputFocused) {
      scrollWizardTo(0)
    }
  }, [activeStep, keyboardHeight, isIdentityInputFocused, scrollWizardTo])

  const handleIdentityFocus = (): void => {
    identityScrollBeforeFocusRef.current = scrollOffsetRef.current
    setIsIdentityInputFocused(true)
    setTimeout(() => {
      scrollIdentitySectionAboveKeyboard()
    }, 140)
  }

  const handleIdentityBlur = (): void => {
    setIsIdentityInputFocused(false)
  }

  const handleIdentityLayout = (layout: LayoutRectangle): void => {
    identitySectionLayoutRef.current = layout
  }

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: false,
    listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y
    },
  })

  return {
    scrollRef,
    animation,
    heroTopOffset,
    topSpacerHeight,
    scrollContentBottomPadding,
    scrollEnabled: activeStep !== "identity" || identityEditing,
    preserveIdentityRailSpace,
    openWizardStep,
    handleIdentityFocus,
    handleIdentityBlur,
    handleIdentityLayout,
    handleScroll,
  }
}

export type WizardAnimation = ReturnType<typeof useWizardScroll>["animation"]
