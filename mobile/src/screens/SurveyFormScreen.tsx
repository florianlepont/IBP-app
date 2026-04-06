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
import { brandColors, brandSpacing } from "../app/brand-tokens"
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
import { AppField } from "../ui/AppField"
import { AppNotice } from "../ui/AppNotice"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { screenStyles } from "./SurveyFormScreen.styles"
import {
  FACTOR_ICONS,
  FACTOR_ORDER,
  FactorTile,
  StepButton,
  WizardChip,
  toAddressLabel,
} from "./SurveyFormScreen.components"
export { toAddressLabel } from "./SurveyFormScreen.components"
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
      setMapRegion((current) => (areRegionsNearlyEqual(current, nextRegion) ? current : nextRegion))
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
                <AppNotice
                  tone="info"
                  icon="navigate-outline"
                  title="Local address"
                  message="Looking up..."
                />
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
              <AppButton
                label={persistLabel}
                style={screenStyles.primaryButtonWide}
                onPress={handlePersistSurvey}
              />
            </View>
          </>
        ) : null}
      </Animated.ScrollView>
    </View>
  )
}
