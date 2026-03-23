import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Button,
  Keyboard,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs"
import { useHeaderHeight } from "@react-navigation/elements"
import { Ionicons } from "@expo/vector-icons"
import MapView, { Marker, Region } from "react-native-maps"
import * as Location from "expo-location"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  brandColors,
  brandRadius,
  brandShadow,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"
import { FACTOR_TITLES, REGION_OPTIONS, VEGETATION_STAGE_OPTIONS_BY_REGION } from "../app/constants"
import { computeIbpTotalsFromRetainedScores } from "../app/ibp-scoring"
import {
  DEFAULT_FRANCE_CENTER,
  areRegionsNearlyEqual,
  buildFocusedMapRegion,
  computeRegionZoom,
} from "../app/map-viewport"
import {
  AppScreen,
  FactorField,
  FactorKey,
  FactorRetainedScore,
  GpsCaptureResult,
  RegionVersion,
  VegetationStage,
} from "../app/types"
import { IgnCadastreTileOverlay } from "../components/IgnCadastreTileOverlay"
import { ParcelOverlayPolygons } from "../components/ParcelOverlayPolygons"
import { useParcelStatuses } from "../hooks/useParcelStatuses"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppChoiceChip } from "../ui/AppChoiceChip"
import { AppField } from "../ui/AppField"
import { AppNotice } from "../ui/AppNotice"
import { AppSectionHeader } from "../ui/AppSectionHeader"

type SurveyFormScreenProps = {
  apiUrl: string
  screen: AppScreen
  editingSurveyId: string | null
  siteName: string
  setSiteName: (value: string) => void
  regionVersion: RegionVersion
  vegetationStage: VegetationStage
  setVegetationStage: (value: VegetationStage) => void
  onRegionChange: (nextRegion: RegionVersion) => void
  gpsLocation: {
    lat: string
    lng: string
    collected_at: string
  }
  selectedParcelIds: string[]
  onToggleParcelSelection: (parcelId: string) => void
  onCaptureGpsLocation: () => Promise<GpsCaptureResult | null>
  factorSections: Record<FactorKey, FactorField[]>
  factorRetainedScores: Record<FactorKey, FactorRetainedScore | null>
  formErrors: { siteName: string | null }
  onOpenFactor: (factor: FactorKey) => void
  onOpenParcelFullscreen: () => void
  onSaveSurveyEdits: () => Promise<void>
  onCreateDraft: () => Promise<void>
  status: string
}

type WizardStep = "identity" | "parcels" | "factors"

const FACTOR_ORDER: FactorKey[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
const FACTOR_ICONS: Record<FactorKey, keyof typeof Ionicons.glyphMap> = {
  A: "leaf-outline",
  B: "layers-outline",
  C: "git-branch-outline",
  D: "reorder-three-outline",
  E: "resize-outline",
  F: "sparkles-outline",
  G: "flower-outline",
  H: "git-network-outline",
  I: "water-outline",
  J: "triangle-outline",
}

function StepButton({
  index,
  label,
  meta,
  active,
  complete,
  disabled = false,
  onPress,
}: {
  index: string
  label: string
  meta: string
  active: boolean
  complete: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        screenStyles.stepButton,
        active ? screenStyles.stepButtonActive : null,
        complete && !active ? screenStyles.stepButtonComplete : null,
        disabled ? screenStyles.stepButtonDisabled : null,
      ]}
    >
      <View style={screenStyles.stepButtonTopRow}>
        <View
          style={[screenStyles.stepIndexPill, active ? screenStyles.stepIndexPillActive : null]}
        >
          <Text
            style={[screenStyles.stepIndexText, active ? screenStyles.stepIndexTextActive : null]}
          >
            {index}
          </Text>
        </View>
        <Ionicons
          name={
            active ? "radio-button-on" : complete ? "checkmark-circle" : "chevron-forward-circle"
          }
          size={18}
          color={
            active ? brandColors.white : complete ? brandColors.forest : brandColors.textSecondary
          }
        />
      </View>
      <Text
        numberOfLines={1}
        style={[screenStyles.stepButtonTitle, active ? screenStyles.stepButtonTitleActive : null]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[screenStyles.stepButtonMeta, active ? screenStyles.stepButtonMetaActive : null]}
      >
        {meta}
      </Text>
      <Text
        numberOfLines={1}
        style={[screenStyles.stepButtonHint, active ? screenStyles.stepButtonHintActive : null]}
      >
        {active ? "Current step" : disabled ? "Name required" : "Tap to open"}
      </Text>
    </Pressable>
  )
}

function WizardChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return <AppChoiceChip label={label} active={active} onPress={onPress} />
}

function FactorTile({
  factor,
  factorIcon,
  title,
  progress,
  retainedScore,
  onPress,
}: {
  factor: FactorKey
  factorIcon: keyof typeof Ionicons.glyphMap
  title: string
  progress: { complete: boolean; filled: number; total: number; invalid: number }
  retainedScore: FactorRetainedScore | null
  onPress: () => void
}) {
  const toneStyle = progress.complete
    ? screenStyles.factorTileComplete
    : progress.invalid > 0
      ? screenStyles.factorTileWarning
      : screenStyles.factorTilePending
  const iconName = progress.complete
    ? "checkmark-circle"
    : progress.invalid > 0
      ? "alert-circle"
      : "ellipse-outline"
  const iconColor = progress.complete
    ? brandColors.forest
    : progress.invalid > 0
      ? brandColors.terracotta
      : brandColors.textSecondary

  return (
    <Pressable onPress={onPress} style={[screenStyles.factorTile, toneStyle]}>
      <View style={screenStyles.factorTileTopRow}>
        <View style={screenStyles.factorTileIdentity}>
          <View style={screenStyles.factorBadge}>
            <Text style={screenStyles.factorBadgeText}>{factor}</Text>
          </View>
          <View style={screenStyles.factorIconWrap}>
            <Ionicons name={factorIcon} size={16} color={brandColors.forest} />
          </View>
        </View>
        <Ionicons name={iconName} size={16} color={iconColor} />
      </View>
      <Text numberOfLines={2} style={screenStyles.factorTileTitle}>
        {title}
      </Text>
      <Text style={screenStyles.factorTileMeta}>
        {progress.filled}/{progress.total} fields
      </Text>
      <Text style={screenStyles.factorTileState}>
        {retainedScore
          ? `${retainedScore.selected_class} · ${retainedScore.score} pts`
          : progress.complete
            ? "Ready"
            : "Pending"}
      </Text>
    </Pressable>
  )
}

export const toAddressLabel = (item: Record<string, unknown>): string => {
  const streetNumber = typeof item.streetNumber === "string" ? item.streetNumber.trim() : ""
  const street = typeof item.street === "string" ? item.street.trim() : ""
  const postalCode = typeof item.postalCode === "string" ? item.postalCode.trim() : ""
  const city = typeof item.city === "string" ? item.city.trim() : ""
  const region = typeof item.region === "string" ? item.region.trim() : ""
  const country = typeof item.country === "string" ? item.country.trim() : ""

  const line1 = [streetNumber, street].filter((part) => part.length > 0).join(" ")
  const line2 = [postalCode, city].filter((part) => part.length > 0).join(" ")
  const line3 = [region, country].filter((part) => part.length > 0).join(", ")
  return [line1, line2, line3].filter((part) => part.length > 0).join(" - ")
}

export function SurveyFormScreen({
  apiUrl,
  screen,
  editingSurveyId,
  siteName,
  setSiteName,
  regionVersion,
  vegetationStage,
  setVegetationStage,
  onRegionChange,
  gpsLocation,
  selectedParcelIds,
  onToggleParcelSelection,
  onCaptureGpsLocation,
  factorSections,
  factorRetainedScores,
  formErrors,
  onOpenFactor,
  onOpenParcelFullscreen,
  onSaveSurveyEdits,
  onCreateDraft,
  status: _status,
}: SurveyFormScreenProps) {
  const inlineMapRef = useRef<MapView | null>(null)
  const fullscreenMapRef = useRef<MapView | null>(null)
  const inlineMapReadyRef = useRef(false)
  const fullscreenMapReadyRef = useRef(false)
  const pendingInlineRegionRef = useRef<Region | null>(null)
  const pendingFullscreenRegionRef = useRef<Region | null>(null)
  const scrollRef = useRef<ScrollView | null>(null)
  const scrollOffsetRef = useRef(0)
  const identityScrollBeforeFocusRef = useRef(0)
  const onCaptureGpsLocationRef = useRef(onCaptureGpsLocation)
  const parcelLocateRequestIdRef = useRef(0)
  const identitySectionLayoutRef = useRef({ y: 0, height: 0 })
  const scrollY = useRef(new Animated.Value(0)).current
  const { height: viewportHeight } = useWindowDimensions()
  const tabBarHeight = useBottomTabBarHeight()
  const headerHeight = useHeaderHeight()
  const insets = useSafeAreaInsets()
  const [activeStep, setActiveStep] = useState<WizardStep>("identity")
  const [autoLocateRequested, setAutoLocateRequested] = useState(false)
  const [isAutoLocatingParcels, setIsAutoLocatingParcels] = useState(false)
  const [parcelAutoLocateError, setParcelAutoLocateError] = useState("")
  const [isParcelMapFullscreenVisible, setIsParcelMapFullscreenVisible] = useState(false)
  const [resolvedGpsAddress, setResolvedGpsAddress] = useState("")
  const [isResolvingGpsAddress, setIsResolvingGpsAddress] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [isIdentityInputFocused, setIsIdentityInputFocused] = useState(false)
  const lastResolvedCoordinateKeyRef = useRef("")

  const parsedLat = Number(gpsLocation.lat)
  const parsedLng = Number(gpsLocation.lng)
  const hasGpsCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
  const mapCenter = hasGpsCoordinates ? { lat: parsedLat, lng: parsedLng } : DEFAULT_FRANCE_CENTER
  const computedMapRegion: Region = hasGpsCoordinates
    ? buildFocusedMapRegion(mapCenter)
    : {
        latitude: mapCenter.lat,
        longitude: mapCenter.lng,
        latitudeDelta: 3.8,
        longitudeDelta: 3.8,
      }
  const [mapRegion, setMapRegion] = useState<Region>(computedMapRegion)
  const mapZoom = useMemo(() => computeRegionZoom(mapRegion), [mapRegion])
  const { items: parcelStatuses, loading: parcelsLoading } = useParcelStatuses({
    apiUrl,
    region: mapRegion,
    enabled: true,
    year: new Date().getFullYear(),
  })

  useEffect(() => {
    onCaptureGpsLocationRef.current = onCaptureGpsLocation
  }, [onCaptureGpsLocation])

  const animateParcelMapRegion = useCallback(
    (
      mapRef: typeof inlineMapRef,
      mapReadyRef: typeof inlineMapReadyRef,
      pendingRegionRef: typeof pendingInlineRegionRef,
      nextRegion: Region,
      duration = 420,
    ): void => {
      if (!mapReadyRef.current || !mapRef.current) {
        pendingRegionRef.current = nextRegion
        return
      }

      pendingRegionRef.current = null
      mapRef.current.animateToRegion(nextRegion, duration)
    },
    [],
  )

  const syncParcelMapsToRegion = useCallback(
    (nextRegion: Region, duration = 420): void => {
      animateParcelMapRegion(
        inlineMapRef,
        inlineMapReadyRef,
        pendingInlineRegionRef,
        nextRegion,
        duration,
      )
      animateParcelMapRegion(
        fullscreenMapRef,
        fullscreenMapReadyRef,
        pendingFullscreenRegionRef,
        nextRegion,
        duration,
      )
    },
    [animateParcelMapRegion],
  )

  const scrollWizardTo = useCallback((y: number, animated = true): void => {
    scrollRef.current?.scrollTo?.({ y, animated })
  }, [])

  const centerParcelMapsOnLocation = useCallback(
    (location: GpsCaptureResult): void => {
      const nextRegion = buildFocusedMapRegion(location)
      setMapRegion((current) =>
        areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion,
      )
      syncParcelMapsToRegion(nextRegion, 420)
    },
    [syncParcelMapsToRegion],
  )

  const handleInlineMapReady = (): void => {
    inlineMapReadyRef.current = true
    const nextRegion = pendingInlineRegionRef.current ?? mapRegion
    pendingInlineRegionRef.current = null
    requestAnimationFrame(() => {
      inlineMapRef.current?.animateToRegion(nextRegion, 0)
    })
  }

  const handleFullscreenMapReady = (): void => {
    fullscreenMapReadyRef.current = true
    const nextRegion = pendingFullscreenRegionRef.current ?? mapRegion
    pendingFullscreenRegionRef.current = null
    requestAnimationFrame(() => {
      fullscreenMapRef.current?.animateToRegion(nextRegion, 0)
    })
  }

  useEffect(() => {
    if (!hasGpsCoordinates) {
      return
    }
    const nextRegion = buildFocusedMapRegion({ lat: parsedLat, lng: parsedLng })
    setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion))
    syncParcelMapsToRegion(nextRegion, 420)
  }, [gpsLocation.collected_at, hasGpsCoordinates, parsedLat, parsedLng, syncParcelMapsToRegion])

  const factorProgress = useMemo(
    () =>
      FACTOR_ORDER.reduce<
        Record<FactorKey, { complete: boolean; filled: number; total: number; invalid: number }>
      >(
        (acc, factor) => {
          const fields = factorSections[factor]
          const total = fields.length
          const filled = fields.filter((field) => field.value.trim().length > 0).length
          const invalid = fields.filter((field) => Boolean(field.error)).length
          acc[factor] = {
            complete: total > 0 && filled === total && invalid === 0,
            filled,
            total,
            invalid,
          }
          return acc
        },
        {} as Record<
          FactorKey,
          { complete: boolean; filled: number; total: number; invalid: number }
        >,
      ),
    [factorSections],
  )

  const completedFactorCount = FACTOR_ORDER.filter(
    (factor) => factorProgress[factor]?.complete,
  ).length
  const scoreTotals = useMemo(
    () => computeIbpTotalsFromRetainedScores(factorRetainedScores),
    [factorRetainedScores],
  )
  const regionLabel = useMemo(
    () => REGION_OPTIONS.find((option) => option.value === regionVersion)?.label ?? regionVersion,
    [regionVersion],
  )
  const vegetationLabel = useMemo(
    () =>
      VEGETATION_STAGE_OPTIONS_BY_REGION[regionVersion].find(
        (option) => option.value === vegetationStage,
      )?.label ?? vegetationStage,
    [regionVersion, vegetationStage],
  )

  const identityReady = siteName.trim().length > 0
  const parcelsReady = selectedParcelIds.length > 0
  const factorsReady = completedFactorCount === FACTOR_ORDER.length
  const persistLabel = screen === "edit" ? "Save changes" : "Save draft"

  const stepMeta = useMemo(
    () => ({
      identity: siteName.trim() ? "Name locked" : "Name your site",
      parcels: !identityReady
        ? "Name required first"
        : selectedParcelIds.length > 0
          ? `${selectedParcelIds.length} selected`
          : "Map + context",
      factors: !identityReady
        ? "Name required first"
        : completedFactorCount > 0
          ? `${completedFactorCount}/10 scored`
          : "Start scoring",
    }),
    [completedFactorCount, identityReady, selectedParcelIds.length, siteName],
  )

  const heroCopy = useMemo(() => {
    if (activeStep === "identity") {
      return {
        title: screen === "edit" ? "Refine survey identity" : "Start a new survey",
        body: "Give the survey a clear name before you anchor it on the cadastre and score the field observations.",
        pills: [
          siteName.trim() || "Name required",
          selectedParcelIds.length ? `${selectedParcelIds.length} parcel(s)` : "No parcel yet",
        ],
      }
    }

    if (activeStep === "parcels") {
      return {
        title: "Anchor the survey on the map",
        body: "Select the parcel footprint, then lock the region version and vegetation stage for the scoring rules.",
        pills: [regionLabel, vegetationLabel, `${selectedParcelIds.length} parcel(s)`],
      }
    }

    return {
      title: "Score the IBP factors",
      body: "Open each factor, enter the observed values, and watch the retained scores build the total live.",
      pills: [
        `IBP ${scoreTotals.ibp_total}`,
        `${completedFactorCount}/10 factors`,
        `${selectedParcelIds.length} parcel(s)`,
      ],
    }
  }, [
    activeStep,
    completedFactorCount,
    regionLabel,
    screen,
    scoreTotals.ibp_total,
    selectedParcelIds.length,
    siteName,
    vegetationLabel,
  ])

  const compactSummary = heroCopy.pills.join(" • ")
  const heroTopOffset = Math.max(headerHeight - insets.top, 0) + 42
  const heroContentTopInset = 18
  const expandedHeroHeight = Math.max(248, Math.min(292, Math.round(viewportHeight * 0.27)))
  const collapsedHeroHeight = 84
  const collapseDistance = expandedHeroHeight - collapsedHeroHeight
  const topSpacerHeight = heroTopOffset + expandedHeroHeight + brandSpacing.xs
  const minimumTabBarHeight = Platform.select({ ios: 84, default: 68 }) ?? 68
  const bottomActionClearance = Math.max(tabBarHeight, minimumTabBarHeight) + brandSpacing.xs
  const scrollContentBottomPadding =
    keyboardHeight > 0 ? keyboardHeight + 72 : bottomActionClearance
  const scrollIdentitySectionAboveKeyboard = useCallback(
    (keyboardFrameHeight = keyboardHeight): void => {
      const visibleTop = heroTopOffset + collapsedHeroHeight + brandSpacing.md
      const visibleBottom = viewportHeight - keyboardFrameHeight - brandSpacing.lg
      const { y, height } = identitySectionLayoutRef.current
      const targetY = Math.max(y - visibleTop, y + height - visibleBottom, 0)
      scrollWizardTo(targetY)
    },
    [collapsedHeroHeight, heroTopOffset, keyboardHeight, scrollWizardTo, viewportHeight],
  )

  const heroHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [expandedHeroHeight, collapsedHeroHeight],
    extrapolate: "clamp",
  })
  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.36, collapseDistance * 0.62],
    outputRange: [1, 0.22, 0],
    extrapolate: "clamp",
  })
  const expandedTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.62],
    outputRange: [0, -10],
    extrapolate: "clamp",
  })
  const compactOpacity = scrollY.interpolate({
    inputRange: [collapseDistance * 0.42, collapseDistance * 0.72, collapseDistance],
    outputRange: [0, 0.65, 1],
    extrapolate: "clamp",
  })
  const compactTranslateY = scrollY.interpolate({
    inputRange: [collapseDistance * 0.42, collapseDistance],
    outputRange: [8, 0],
    extrapolate: "clamp",
  })
  const stepRailOpacity = scrollY.interpolate({
    inputRange: [0, 36, 88],
    outputRange: [1, 0.45, 0],
    extrapolate: "clamp",
  })
  const stepRailScale = scrollY.interpolate({
    inputRange: [0, 88],
    outputRange: [1, 0.92],
    extrapolate: "clamp",
  })
  const stepRailTranslateY = scrollY.interpolate({
    inputRange: [0, 88],
    outputRange: [0, -18],
    extrapolate: "clamp",
  })
  const stepRailHeight = scrollY.interpolate({
    inputRange: [0, 88],
    outputRange: [114, 0],
    extrapolate: "clamp",
  })
  const compactProgressOpacity = scrollY.interpolate({
    inputRange: [collapseDistance * 0.38, collapseDistance * 0.68, collapseDistance],
    outputRange: [0, 0.55, 1],
    extrapolate: "clamp",
  })

  const activeStepIndex = activeStep === "identity" ? 0 : activeStep === "parcels" ? 1 : 2
  const preserveIdentityRailSpace =
    activeStep === "identity" && (isIdentityInputFocused || keyboardHeight > 0)
  useEffect(() => {
    if (activeStep !== "parcels") {
      parcelLocateRequestIdRef.current += 1
      setAutoLocateRequested(false)
      setIsAutoLocatingParcels(false)
      setParcelAutoLocateError("")
      return
    }

    if (hasGpsCoordinates) {
      setIsAutoLocatingParcels(false)
      setParcelAutoLocateError("")
      return
    }

    if (autoLocateRequested) {
      return
    }

    const requestId = parcelLocateRequestIdRef.current + 1
    parcelLocateRequestIdRef.current = requestId
    setAutoLocateRequested(true)
    setIsAutoLocatingParcels(true)
    setParcelAutoLocateError("")

    void onCaptureGpsLocationRef
      .current()
      .then((capturedLocation) => {
        if (parcelLocateRequestIdRef.current !== requestId) {
          return
        }
        setIsAutoLocatingParcels(false)
        if (!capturedLocation) {
          setParcelAutoLocateError(
            "Current position unavailable. Open the full-screen map to retry or browse manually.",
          )
          return
        }
        centerParcelMapsOnLocation(capturedLocation)
      })
      .catch(() => {
        if (parcelLocateRequestIdRef.current !== requestId) {
          return
        }
        setIsAutoLocatingParcels(false)
        setParcelAutoLocateError(
          "Current position unavailable. Open the full-screen map to retry or browse manually.",
        )
      })
  }, [activeStep, autoLocateRequested, centerParcelMapsOnLocation, hasGpsCoordinates])

  useEffect(() => {
    if (!hasGpsCoordinates) {
      setResolvedGpsAddress("")
      setIsResolvingGpsAddress(false)
      return
    }

    const coordinateKey = `${parsedLat.toFixed(5)},${parsedLng.toFixed(5)}`
    if (lastResolvedCoordinateKeyRef.current === coordinateKey) {
      return
    }
    lastResolvedCoordinateKeyRef.current = coordinateKey

    let cancelled = false
    const run = async (): Promise<void> => {
      try {
        setIsResolvingGpsAddress(true)
        const matches = await Location.reverseGeocodeAsync({
          latitude: parsedLat,
          longitude: parsedLng,
        })
        if (cancelled) {
          return
        }
        const first = matches[0] as Record<string, unknown> | undefined
        if (!first) {
          setResolvedGpsAddress("Adresse locale non disponible")
          return
        }
        const label = toAddressLabel(first)
        setResolvedGpsAddress(label || "Adresse locale non disponible")
      } catch (_error) {
        if (!cancelled) {
          setResolvedGpsAddress("Adresse locale non disponible")
        }
      } finally {
        if (!cancelled) {
          setIsResolvingGpsAddress(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [hasGpsCoordinates, parsedLat, parsedLng])

  useEffect(() => {
    setActiveStep("identity")
    setAutoLocateRequested(false)
  }, [screen, editingSurveyId])

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

  const handlePersistSurvey = (): void => {
    if (screen === "edit") {
      void onSaveSurveyEdits()
      return
    }
    void onCreateDraft()
  }

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

  const handleOpenIdentityStep = (): void => {
    openWizardStep("identity")
  }

  const handleOpenParcelsStep = (): void => {
    if (!identityReady) {
      return
    }
    openWizardStep("parcels")
  }

  const handleOpenFactorsStep = (): void => {
    if (!identityReady) {
      return
    }
    openWizardStep("factors")
  }

  const handleLocateParcelsMap = (): void => {
    if (isAutoLocatingParcels) {
      return
    }

    const requestId = parcelLocateRequestIdRef.current + 1
    parcelLocateRequestIdRef.current = requestId
    setIsAutoLocatingParcels(true)
    setParcelAutoLocateError("")

    void onCaptureGpsLocationRef
      .current()
      .then((capturedLocation) => {
        if (parcelLocateRequestIdRef.current !== requestId) {
          return
        }
        setIsAutoLocatingParcels(false)
        if (!capturedLocation) {
          setParcelAutoLocateError(
            "Current position unavailable. Browse the map manually or try again.",
          )
          return
        }
        centerParcelMapsOnLocation(capturedLocation)
      })
      .catch(() => {
        if (parcelLocateRequestIdRef.current !== requestId) {
          return
        }
        setIsAutoLocatingParcels(false)
        setParcelAutoLocateError(
          "Current position unavailable. Browse the map manually or try again.",
        )
      })
  }

  const handleMapRegionChange = (nextRegion: Region): void => {
    setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion))
  }

  const parcelMapHelperText = useMemo(() => {
    if (isAutoLocatingParcels) {
      return "Centering on your current position..."
    }
    if (parcelAutoLocateError) {
      return parcelAutoLocateError
    }
    if (mapZoom >= 15) {
      return parcelsLoading
        ? "Loading parcel overlay..."
        : `${parcelStatuses.length} visible parcel(s) · tap polygons to select or deselect`
    }
    return "Zoom in to unlock parcel selection"
  }, [isAutoLocatingParcels, mapZoom, parcelAutoLocateError, parcelStatuses.length, parcelsLoading])
  const hasParcelSelection = selectedParcelIds.length > 0
  const parcelSelectionLabel = `${selectedParcelIds.length} parcel${selectedParcelIds.length > 1 ? "s" : ""} selected`
  const fullscreenParcelSelectionTitle = hasParcelSelection
    ? parcelSelectionLabel
    : "No parcel selected yet"

  useEffect(() => {
    if (activeStep === "identity" && keyboardHeight === 0 && !isIdentityInputFocused) {
      scrollWizardTo(0)
    }
  }, [activeStep, keyboardHeight, isIdentityInputFocused, scrollWizardTo])

  useEffect(() => {
    if (hasGpsCoordinates) {
      return
    }
    const fallbackRegion: Region = {
      latitude: DEFAULT_FRANCE_CENTER.lat,
      longitude: DEFAULT_FRANCE_CENTER.lng,
      latitudeDelta: 3.8,
      longitudeDelta: 3.8,
    }
    setMapRegion((current) =>
      areRegionsNearlyEqual(current, fallbackRegion) ? current : fallbackRegion,
    )
  }, [hasGpsCoordinates, screen, editingSurveyId])

  useEffect(() => {
    if (isParcelMapFullscreenVisible) {
      return
    }
    syncParcelMapsToRegion(mapRegion, 0)
  }, [isParcelMapFullscreenVisible, mapRegion, syncParcelMapsToRegion])

  return (
    <View style={screenStyles.container}>
      <Animated.View
        pointerEvents="none"
        style={[
          screenStyles.heroShell,
          {
            top: heroTopOffset,
            height: heroHeight,
          },
        ]}
      >
        <View style={screenStyles.heroCard}>
          <View style={screenStyles.heroAccentOrb} />
          <Animated.View
            style={[
              screenStyles.heroExpandedLayer,
              {
                paddingTop: heroContentTopInset,
                opacity: expandedOpacity,
                transform: [{ translateY: expandedTranslateY }],
              },
            ]}
          >
            <View style={screenStyles.heroExpandedHeader}>
              <Text style={screenStyles.heroEyebrow}>
                Survey wizard · Step{" "}
                {activeStep === "identity" ? "1" : activeStep === "parcels" ? "2" : "3"} of 3
              </Text>
              <Text style={screenStyles.heroTitleExpanded}>{heroCopy.title}</Text>
              <Text style={screenStyles.heroBody}>{heroCopy.body}</Text>
            </View>

            <View style={screenStyles.heroMetaRow}>
              {heroCopy.pills.map((pill) => (
                <View key={`${activeStep}-${pill}`} style={screenStyles.heroMetaPill}>
                  <Text style={screenStyles.heroMetaPillText}>{pill}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View
            style={[
              screenStyles.heroCompactLayer,
              {
                opacity: compactOpacity,
                transform: [{ translateY: compactTranslateY }],
              },
            ]}
          >
            <Text numberOfLines={1} style={screenStyles.heroCompactSummary}>
              {compactSummary}
            </Text>
            <Animated.View
              style={[screenStyles.compactProgressWrap, { opacity: compactProgressOpacity }]}
            >
              <Text style={screenStyles.compactProgressCount}>Step {activeStepIndex + 1}/3</Text>
              <View style={screenStyles.compactProgressTrack}>
                {(["identity", "parcels", "factors"] as WizardStep[]).map((step, index) => (
                  <View
                    key={`compact-progress-${step}`}
                    style={[
                      screenStyles.compactProgressSegment,
                      index < activeStepIndex
                        ? screenStyles.compactProgressSegmentComplete
                        : index === activeStepIndex
                          ? screenStyles.compactProgressSegmentActive
                          : null,
                    ]}
                  />
                ))}
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        style={screenStyles.pageScroll}
        contentContainerStyle={[
          screenStyles.pageContent,
          { paddingBottom: scrollContentBottomPadding },
        ]}
        scrollEnabled={activeStep !== "identity" || isIdentityInputFocused || keyboardHeight > 0}
        bounces={activeStep !== "identity" || isIdentityInputFocused || keyboardHeight > 0}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
          listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y
          },
        })}
      >
        <View style={{ height: topSpacerHeight }} />

        <Animated.View
          style={[
            screenStyles.stepRailWrap,
            {
              height: preserveIdentityRailSpace ? 114 : stepRailHeight,
              marginTop: -brandSpacing.xs,
              opacity: stepRailOpacity,
              transform: [{ translateY: stepRailTranslateY }, { scale: stepRailScale }],
            },
          ]}
        >
          <View style={screenStyles.stepRailCard}>
            <View style={screenStyles.stepRow}>
              <StepButton
                index="01"
                label="Identity"
                meta={stepMeta.identity}
                active={activeStep === "identity"}
                complete={identityReady}
                onPress={handleOpenIdentityStep}
              />
              <StepButton
                index="02"
                label="Parcels"
                meta={stepMeta.parcels}
                active={activeStep === "parcels"}
                complete={parcelsReady}
                disabled={!identityReady}
                onPress={handleOpenParcelsStep}
              />
              <StepButton
                index="03"
                label="Factors"
                meta={stepMeta.factors}
                active={activeStep === "factors"}
                complete={factorsReady}
                disabled={!identityReady}
                onPress={handleOpenFactorsStep}
              />
            </View>
          </View>
        </Animated.View>

        {activeStep === "identity" ? (
          <View
            style={screenStyles.identityStepContent}
            onLayout={(event) => {
              identitySectionLayoutRef.current = event.nativeEvent.layout
            }}
          >
            <AppCard variant="panelElevated" style={screenStyles.panel}>
              <AppSectionHeader
                title="Survey identity"
                subtitle="Give the draft a name that will stay readable in lists, sync logs, and parcel detail screens."
                titleStyle={screenStyles.panelTitle}
                subtitleStyle={screenStyles.panelBody}
              />

              <AppField
                label="Site name *"
                value={siteName}
                onChangeText={setSiteName}
                onFocus={() => {
                  identityScrollBeforeFocusRef.current = scrollOffsetRef.current
                  setIsIdentityInputFocused(true)
                  setTimeout(() => {
                    scrollIdentitySectionAboveKeyboard()
                  }, 140)
                }}
                onBlur={() => {
                  setIsIdentityInputFocused(false)
                }}
                placeholder="Ex: Foret de Rambouillet"
                error={formErrors.siteName}
                inputStyle={screenStyles.input}
              />
            </AppCard>

            <AppButton
              label="Continue to parcels"
              disabled={!identityReady}
              style={screenStyles.primaryButton}
              onPress={handleOpenParcelsStep}
            />
          </View>
        ) : null}

        {activeStep === "parcels" ? (
          <>
            <AppCard variant="panelElevated" style={screenStyles.panel}>
              <View style={screenStyles.parcelHeaderRow}>
                <AppSectionHeader
                  title="Parcel selection"
                  subtitle="Centered on your position when available. Zoom in, then tap parcels."
                  style={screenStyles.panelHeaderCompact}
                  titleStyle={screenStyles.panelTitle}
                  subtitleStyle={screenStyles.panelBody}
                />
                <View style={screenStyles.selectionCountPill}>
                  <Text style={screenStyles.selectionCountPillText}>
                    {selectedParcelIds.length} selected
                  </Text>
                </View>
              </View>

              <View style={screenStyles.mapFrame}>
                <MapView
                  ref={(instance) => {
                    inlineMapRef.current = instance
                    if (!instance) {
                      inlineMapReadyRef.current = false
                      return
                    }
                    inlineMapReadyRef.current = false
                  }}
                  style={screenStyles.map}
                  initialRegion={mapRegion}
                  onMapReady={handleInlineMapReady}
                  onRegionChangeComplete={handleMapRegionChange}
                >
                  <IgnCadastreTileOverlay enabled={mapZoom >= 15} zIndex={0} />
                  <ParcelOverlayPolygons
                    items={parcelStatuses}
                    selectedParcelIds={selectedParcelIds}
                    onParcelPress={onToggleParcelSelection}
                  />
                  {hasGpsCoordinates ? (
                    <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} />
                  ) : null}
                </MapView>
                <View pointerEvents="box-none" style={screenStyles.mapOverlayActions}>
                  <Pressable style={screenStyles.mapOverlayButton} onPress={onOpenParcelFullscreen}>
                    <Ionicons name="expand-outline" size={15} color={brandColors.white} />
                    <Text style={screenStyles.mapOverlayButtonText}>Full screen</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={screenStyles.mapHelperText}>{parcelMapHelperText}</Text>

              {selectedParcelIds.length > 0 ? (
                <View style={screenStyles.selectionSummaryRow}>
                  {selectedParcelIds.slice(0, 4).map((parcelId) => (
                    <View key={parcelId} style={screenStyles.selectionPill}>
                      <Text style={screenStyles.selectionPillText}>{parcelId}</Text>
                    </View>
                  ))}
                  {selectedParcelIds.length > 4 ? (
                    <View style={screenStyles.selectionPill}>
                      <Text style={screenStyles.selectionPillText}>
                        +{selectedParcelIds.length - 4} more
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {isResolvingGpsAddress ? (
                <AppNotice tone="info" icon="navigate-outline" title="Local address" message="Looking up..." />
              ) : null}

              {resolvedGpsAddress ? (
                <AppNotice
                  tone="info"
                  icon="location-outline"
                  title="Local address"
                  message={resolvedGpsAddress}
                />
              ) : null}
            </AppCard>

            <AppCard variant="panelElevated" style={screenStyles.panel}>
              <AppSectionHeader
                title="Scoring context"
                subtitle="Region version and vegetation stage directly affect the IBP scoring thresholds, so set them before opening factors."
                titleStyle={screenStyles.panelTitle}
                subtitleStyle={screenStyles.panelBody}
              />

              <Text style={screenStyles.label}>Region version *</Text>
              <View style={screenStyles.choiceRow}>
                {REGION_OPTIONS.map((option) => (
                  <WizardChip
                    key={option.value}
                    label={option.label}
                    active={regionVersion === option.value}
                    onPress={() => onRegionChange(option.value)}
                  />
                ))}
              </View>

              <Text style={screenStyles.label}>Vegetation stage *</Text>
              <View style={screenStyles.choiceRow}>
                {VEGETATION_STAGE_OPTIONS_BY_REGION[regionVersion].map((option) => (
                  <WizardChip
                    key={option.value}
                    label={option.label}
                    active={vegetationStage === option.value}
                    onPress={() => setVegetationStage(option.value)}
                  />
                ))}
              </View>
            </AppCard>

            <View style={screenStyles.actionRow}>
              <Pressable
                style={screenStyles.secondaryButton}
                onPress={() => setActiveStep("identity")}
              >
                <Text style={screenStyles.secondaryButtonText}>Back</Text>
              </Pressable>
              <AppButton
                label="Continue to factors"
                style={screenStyles.primaryButtonWide}
                onPress={() => setActiveStep("factors")}
              />
            </View>

            <Modal
              visible={isParcelMapFullscreenVisible}
              animationType="slide"
              presentationStyle="fullScreen"
              onRequestClose={() => setIsParcelMapFullscreenVisible(false)}
            >
              <View style={screenStyles.fullscreenMapScreen}>
                <MapView
                  ref={(instance) => {
                    fullscreenMapRef.current = instance
                    if (!instance) {
                      fullscreenMapReadyRef.current = false
                      return
                    }
                    fullscreenMapReadyRef.current = false
                  }}
                  style={screenStyles.fullscreenMap}
                  initialRegion={mapRegion}
                  onMapReady={handleFullscreenMapReady}
                  onRegionChangeComplete={handleMapRegionChange}
                >
                  <IgnCadastreTileOverlay enabled={mapZoom >= 15} zIndex={0} />
                  <ParcelOverlayPolygons
                    items={parcelStatuses}
                    selectedParcelIds={selectedParcelIds}
                    onParcelPress={onToggleParcelSelection}
                  />
                  {hasGpsCoordinates ? (
                    <Marker coordinate={{ latitude: parsedLat, longitude: parsedLng }} />
                  ) : null}
                </MapView>

                <View
                  pointerEvents="box-none"
                  style={[
                    screenStyles.fullscreenMapOverlay,
                    {
                      paddingTop: insets.top + 8,
                      paddingBottom: Math.max(insets.bottom, 12) + 12,
                    },
                  ]}
                >
                  <View style={screenStyles.fullscreenMapTopBar}>
                    {Platform.OS === "ios" ? (
                      <>
                        <Button
                          title="Back"
                          color={brandColors.forest}
                          onPress={() => setIsParcelMapFullscreenVisible(false)}
                        />
                        <Text numberOfLines={1} style={screenStyles.fullscreenMapTopTitle}>
                          {siteName.trim() || "Parcel selection"}
                        </Text>
                        <Button
                          title="Done"
                          color={brandColors.forest}
                          onPress={() => setIsParcelMapFullscreenVisible(false)}
                        />
                      </>
                    ) : (
                      <>
                        <Pressable
                          style={screenStyles.fullscreenMapCloseButton}
                          onPress={() => setIsParcelMapFullscreenVisible(false)}
                        >
                          <Ionicons name="arrow-back" size={18} color={brandColors.white} />
                          <Text style={screenStyles.fullscreenMapCloseText}>Back</Text>
                        </Pressable>
                        <Pressable
                          style={screenStyles.fullscreenMapCloseButton}
                          onPress={() => setIsParcelMapFullscreenVisible(false)}
                        >
                          <Text style={screenStyles.fullscreenMapCloseText}>Done</Text>
                        </Pressable>
                      </>
                    )}
                  </View>

                  <View style={screenStyles.fullscreenMapBottomArea}>
                    <View style={screenStyles.fullscreenMapFloatingActions}>
                      <Pressable
                        style={screenStyles.fullscreenMapActionButton}
                        onPress={handleLocateParcelsMap}
                      >
                        <Ionicons
                          name={isAutoLocatingParcels ? "hourglass-outline" : "locate-outline"}
                          size={18}
                          color={brandColors.white}
                        />
                        <Text style={screenStyles.fullscreenMapActionButtonText}>
                          Current position
                        </Text>
                      </Pressable>
                    </View>

                    <View style={screenStyles.fullscreenMapBottomSheet}>
                      <Text style={screenStyles.fullscreenMapBottomTitle}>
                        {fullscreenParcelSelectionTitle}
                      </Text>
                      <Text style={screenStyles.fullscreenMapBottomMeta}>
                        {parcelMapHelperText}
                      </Text>
                      {!hasParcelSelection ? (
                        <View style={screenStyles.fullscreenMapWarningCard}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={18}
                            color={brandColors.terracotta}
                          />
                          <Text style={screenStyles.fullscreenMapWarningText}>
                            Select at least one parcel to continue.
                          </Text>
                        </View>
                      ) : null}
                      <Text style={screenStyles.fullscreenMapBottomHint}>
                        Tap polygons to add or remove parcels without leaving the wizard.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        ) : null}

        {activeStep === "factors" ? (
          <>
            <View style={screenStyles.scoreHeroCard}>
              <Text style={screenStyles.scoreHeroLabel}>IBP total in progress</Text>
              <Text style={screenStyles.scoreHeroValue}>{scoreTotals.ibp_total}</Text>
              <Text style={screenStyles.scoreHeroMeta}>
                Peuplement / gestion {scoreTotals.ibp_peuplement_gestion} · Contexte{" "}
                {scoreTotals.ibp_contexte}
              </Text>
              <Text style={screenStyles.scoreHeroMeta}>
                {scoreTotals.completed_factors}/10 factors currently scoreable
              </Text>
            </View>

            <AppCard variant="panelElevated" style={screenStyles.panel}>
              <AppSectionHeader
                title="Factor scoring"
                subtitle="Open each factor to enter observations and update the score live."
                titleStyle={screenStyles.panelTitle}
                subtitleStyle={screenStyles.panelBody}
              />

              <View style={screenStyles.factorGrid}>
                {FACTOR_ORDER.map((factor) => (
                  <FactorTile
                    key={factor}
                    factor={factor}
                    factorIcon={FACTOR_ICONS[factor]}
                    title={FACTOR_TITLES[factor]}
                    progress={factorProgress[factor]}
                    retainedScore={factorRetainedScores[factor]}
                    onPress={() => onOpenFactor(factor)}
                  />
                ))}
              </View>
            </AppCard>

            <View style={screenStyles.actionRow}>
              <Pressable
                style={screenStyles.secondaryButton}
                onPress={() => setActiveStep("parcels")}
              >
                <Text style={screenStyles.secondaryButtonText}>Back</Text>
              </Pressable>
              <AppButton label={persistLabel} style={screenStyles.primaryButtonWide} onPress={handlePersistSurvey} />
            </View>
          </>
        ) : null}
      </Animated.ScrollView>
    </View>
  )
}

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  heroShell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  heroCard: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: brandColors.forest,
    ...brandShadow.card,
  },
  heroAccentOrb: {
    position: "absolute",
    top: -24,
    right: -18,
    width: 126,
    height: 126,
    borderRadius: 999,
    backgroundColor: "rgba(176, 199, 142, 0.22)",
  },
  heroExpandedLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  heroExpandedHeader: {
    gap: 8,
    paddingRight: 46,
  },
  heroEyebrow: {
    ...brandTypography.heroEyebrow,
    color: "#D7E3C0",
  },
  heroTitleExpanded: {
    ...brandTypography.heroTitle,
    fontSize: 30,
    lineHeight: 34,
    color: brandColors.white,
  },
  heroBody: {
    ...brandTypography.heroBody,
    fontSize: 13,
    lineHeight: 18,
    color: "#E4ECD8",
    maxWidth: 300,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroMetaPill: {
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroMetaPillText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  heroCompactLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingRight: 64,
    paddingBottom: 12,
    gap: 8,
  },
  heroCompactSummary: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  compactProgressWrap: {
    gap: 5,
  },
  compactProgressCount: {
    ...brandTypography.heroEyebrow,
    fontSize: 10,
    lineHeight: 12,
    color: "#D7E3C0",
  },
  compactProgressTrack: {
    flexDirection: "row",
    gap: 6,
  },
  compactProgressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  compactProgressSegmentActive: {
    backgroundColor: brandColors.white,
  },
  compactProgressSegmentComplete: {
    backgroundColor: "#D7E3C0",
  },
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 108,
    gap: 10,
  },
  stepRailWrap: {
    zIndex: 1,
    overflow: "hidden",
    paddingBottom: 0,
  },
  stepRailCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 6,
    ...brandShadow.card,
  },
  stepRow: {
    flexDirection: "row",
    gap: 8,
  },
  stepButton: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 2,
  },
  stepButtonActive: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest,
  },
  stepButtonComplete: {
    borderColor: brandColors.moss,
    backgroundColor: brandColors.successSoft,
  },
  stepButtonDisabled: {
    opacity: 0.52,
  },
  stepButtonTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepIndexPill: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepIndexPillActive: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  stepIndexText: {
    ...brandTypography.heroEyebrow,
    fontSize: 10,
    lineHeight: 12,
    color: brandColors.forest,
  },
  stepIndexTextActive: {
    color: brandColors.white,
  },
  stepButtonTitle: {
    ...brandTypography.label,
    color: brandColors.textPrimary,
  },
  stepButtonTitleActive: {
    color: brandColors.white,
  },
  stepButtonMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  stepButtonMetaActive: {
    color: "#D7E3C0",
  },
  stepButtonHint: {
    marginTop: "auto",
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  stepButtonHintActive: {
    color: brandColors.white,
  },
  panel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 16,
    gap: 10,
    ...brandShadow.card,
  },
  identityStepContent: {
    gap: 10,
  },
  panelHeader: {
    gap: 3,
  },
  panelHeaderCompact: {
    flex: 1,
    gap: 3,
  },
  panelTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 19,
    lineHeight: 22,
    color: brandColors.forest,
  },
  panelBody: {
    ...brandTypography.sectionBody,
    fontSize: 12,
    lineHeight: 17,
    color: brandColors.textSecondary,
  },
  label: {
    ...brandTypography.label,
    color: brandColors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    borderRadius: brandRadius.field,
    backgroundColor: brandColors.inputFill,
    color: brandColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...brandTypography.input,
  },
  errorText: {
    ...brandTypography.meta,
    color: brandColors.terracotta,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceChip: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceChipActive: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest,
  },
  choiceChipText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  choiceChipTextActive: {
    color: brandColors.white,
  },
  parcelHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  selectionCountPill: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.forest,
    backgroundColor: brandColors.successSoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectionCountPillText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  secondaryPillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryPillButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  mapFrame: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.canvas,
  },
  mapOverlayActions: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    padding: 12,
  },
  mapOverlayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(22, 47, 31, 0.76)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapOverlayButtonText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  map: {
    width: "100%",
    height: 408,
  },
  mapHelperText: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  selectionSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectionPill: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  selectionPillText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
    padding: 14,
    gap: 6,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  infoCardTitle: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  infoCardBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  fullscreenMapScreen: {
    flex: 1,
    backgroundColor: "#132434",
  },
  fullscreenMap: {
    flex: 1,
  },
  fullscreenMapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  fullscreenMapTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: "rgba(247, 246, 240, 0.96)",
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 6, default: 10 }),
  },
  fullscreenMapTopTitle: {
    flex: 1,
    textAlign: "center",
    ...brandTypography.label,
    color: brandColors.forest,
  },
  fullscreenMapCloseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(8, 13, 19, 0.72)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fullscreenMapCloseText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  fullscreenMapFloatingActions: {
    alignSelf: "flex-end",
  },
  fullscreenMapActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#8EA97C",
    backgroundColor: brandColors.forest,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: brandRadius.pill,
    ...brandShadow.card,
  },
  fullscreenMapActionButtonText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  fullscreenMapBottomArea: {
    gap: 12,
  },
  fullscreenMapBottomSheet: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: "rgba(247, 246, 240, 0.97)",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
    ...brandShadow.card,
  },
  fullscreenMapBottomTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 20,
    lineHeight: 24,
    color: brandColors.forest,
  },
  fullscreenMapBottomMeta: {
    ...brandTypography.sectionBody,
    fontSize: 13,
    lineHeight: 18,
    color: brandColors.textSecondary,
  },
  fullscreenMapBottomHint: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  fullscreenMapWarningCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E7B8AA",
    backgroundColor: "#F6E1DA",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fullscreenMapWarningText: {
    flex: 1,
    ...brandTypography.meta,
    color: brandColors.terracotta,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    minWidth: 104,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.panel,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    ...brandTypography.button,
    color: brandColors.forest,
  },
  primaryButton: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.forest,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 13,
    ...brandShadow.card,
  },
  primaryButtonDisabled: {
    opacity: 0.48,
  },
  primaryButtonWide: {
    flex: 1,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.forest,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
    ...brandShadow.card,
  },
  primaryButtonText: {
    ...brandTypography.button,
    color: brandColors.white,
  },
  scoreHeroCard: {
    borderRadius: 28,
    backgroundColor: brandColors.white,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 4,
    ...brandShadow.card,
  },
  scoreHeroLabel: {
    ...brandTypography.heroEyebrow,
    color: brandColors.textSecondary,
  },
  scoreHeroValue: {
    fontSize: 52,
    lineHeight: 56,
    fontWeight: "900",
    color: brandColors.forest,
  },
  scoreHeroMeta: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  factorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  factorTile: {
    width: "30.5%",
    minWidth: 92,
    flexGrow: 1,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    borderWidth: 1,
  },
  factorTilePending: {
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
  },
  factorTileComplete: {
    borderColor: brandColors.moss,
    backgroundColor: brandColors.successSoft,
  },
  factorTileWarning: {
    borderColor: brandColors.terracotta,
    backgroundColor: "#F9E5DF",
  },
  factorTileTopRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
    alignItems: "center",
  },
  factorTileIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  factorBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.forest,
  },
  factorBadgeText: {
    ...brandTypography.label,
    fontSize: 11,
    lineHeight: 12,
    color: brandColors.white,
  },
  factorIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
  },
  factorTileTitle: {
    ...brandTypography.label,
    fontSize: 11,
    lineHeight: 13,
    color: brandColors.textPrimary,
  },
  factorTileMeta: {
    ...brandTypography.meta,
    fontSize: 10,
    lineHeight: 12,
    color: brandColors.textSecondary,
  },
  factorTileState: {
    ...brandTypography.meta,
    fontSize: 10,
    lineHeight: 12,
    color: brandColors.forest,
  },
})
