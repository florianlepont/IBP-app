import { useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import MapView, { Marker, Region } from "react-native-maps"
import {
  computeIbpTotalsFromRetainedScores,
  computeRetainedScoresFromRawFactors,
  evaluateSubmitReadinessFromDraft,
} from "../app/ibp-scoring"
import { computeRegionZoom } from "../app/map-viewport"
import {
  FACTOR_TITLES,
  REGION_OPTIONS,
  VEGETATION_STAGE_OPTIONS_BY_REGION,
  defaultVegetationStageForRegion,
  normalizeVegetationStageForRegion,
} from "../app/constants"
import {
  formatDateTime,
  formatEventPayload,
  formatPoints,
  formatRemainingTime,
  isLessThan24HoursRemaining,
  resolveSubmissionDeadline,
} from "../app/formatters"
import {
  brandColors,
  brandRadius,
  brandShadow,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"
import {
  formatSurveySyncDisplayLabel,
  formatSurveyWorkflowStatusLabel,
  resolveSurveySyncDisplay,
  resolveSurveyWorkflowStatus,
} from "../app/survey-logic"
import {
  FactorKey,
  RegionVersion,
  SurveyDetailResponse,
  SurveyDetailTab,
  SurveyEventItem,
  VegetationStage,
} from "../app/types"
import { IgnCadastreTileOverlay } from "../components/IgnCadastreTileOverlay"
import { ParcelOverlayPolygons } from "../components/ParcelOverlayPolygons"
import { useParcelStatuses } from "../hooks/useParcelStatuses"
import { getLocalSurveyDraft, LocalAttachment, LocalSurvey } from "../storage"

type SurveyDetailScreenProps = {
  apiUrl: string
  selectedSurvey: LocalSurvey
  selectedSurveyAttachments: LocalAttachment[]
  surveyDetailTab: SurveyDetailTab
  setSurveyDetailTab: (tab: SurveyDetailTab) => void
  surveyDetails: Record<string, SurveyDetailResponse>
  detailsLoadingSurveyId: string | null
  surveyEvents: Record<string, SurveyEventItem[]>
  eventsLoadingSurveyId: string | null
  onLoadSurveyEvents: (surveyId: string) => Promise<void>
  onTakePhoto: (surveyId: string) => Promise<void> | void
  onPickPhoto: (surveyId: string) => Promise<void> | void
  onDeleteAttachment: (surveyId: string, localAttachmentId: string) => Promise<void> | void
  onDeleteSurvey: (surveyId: string) => void
  onSubmitSurvey: (surveyId: string) => Promise<void>
  onRetrySurvey: (surveyId: string) => Promise<void>
  onDiscardSurvey: (surveyId: string) => Promise<void>
  onToggleVisibility: (surveyId: string, visibility: "private" | "public") => Promise<void>
  onOpenFactor: (surveyId: string, factor: FactorKey) => Promise<void> | void
  onRenameSurvey: (surveyId: string, nextSiteName: string) => Promise<void> | void
  onUpdateRegionVersion: (surveyId: string, region: RegionVersion) => Promise<void> | void
  onUpdateVegetationStage: (surveyId: string, stage: VegetationStage) => Promise<void> | void
  onOpenParcels: (surveyId: string) => Promise<void> | void
}

const FACTOR_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
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

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const resolveDisplayCoordinates = (
  displayLocation?: { lat?: unknown; lng?: unknown } | null,
): { lat: number; lng: number } | null => {
  if (!displayLocation) return null
  const lat = asFiniteNumber(displayLocation.lat)
  const lng = asFiniteNumber(displayLocation.lng)
  if (lat === null || lng === null) return null
  return { lat, lng }
}

type ActionButtonVariant = "neutral" | "primary" | "danger" | "success"
type DisplayedScores = {
  ibp_total: number
  ibp_peuplement_gestion: number
  ibp_contexte: number
}
type DisplayedFactorResult = {
  selected_class: string
  warnings: string[]
}
type LocalDraftMeta = {
  site_name: string
  region_version: RegionVersion
  vegetation_stage: VegetationStage
}
type HeroMode = "map" | "photo"

const FACTOR_ORDER: FactorKey[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
const FACTOR_KEYS = new Set<FactorKey>(FACTOR_ORDER)
const isFactorKey = (value: string): value is FactorKey => FACTOR_KEYS.has(value as FactorKey)
const DEFAULT_FRANCE_REGION: Region = {
  latitude: 46.603354,
  longitude: 1.888334,
  latitudeDelta: 3.8,
  longitudeDelta: 3.8,
}

type ActionButtonProps = {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  variant: ActionButtonVariant
  onPress: () => void
}

function ActionButton({ label, icon, variant, onPress }: ActionButtonProps) {
  return (
    <Pressable
      style={[
        styles.actionButton,
        variant === "neutral"
          ? styles.actionButtonNeutral
          : variant === "primary"
            ? styles.actionButtonPrimary
            : variant === "danger"
              ? styles.actionButtonDanger
              : styles.actionButtonSuccess,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={15}
        color={
          variant === "neutral"
            ? brandColors.forest
            : variant === "primary"
              ? brandColors.white
              : variant === "danger"
                ? brandColors.terracotta
                : brandColors.forest
        }
      />
      <Text
        style={[
          styles.actionButtonText,
          variant === "primary"
            ? styles.actionButtonTextPrimary
            : variant === "danger"
              ? styles.actionButtonTextDanger
              : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

type SurfaceChipTone = "neutral" | "success" | "warning" | "danger"

type SurfaceChipProps = {
  label: string
  active?: boolean
  tone?: SurfaceChipTone
  onPress?: () => void
}

function SurfaceChip({ label, active = false, tone = "neutral", onPress }: SurfaceChipProps) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.filterChip,
        tone === "success"
          ? styles.filterChipSuccess
          : tone === "warning"
            ? styles.filterChipWarning
            : tone === "danger"
              ? styles.filterChipDanger
              : null,
        active ? styles.filterChipActive : null,
        !onPress ? styles.filterChipStatic : null,
      ]}
    >
      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  )
}

export function SurveyDetailScreen({
  apiUrl,
  selectedSurvey,
  selectedSurveyAttachments,
  surveyDetailTab,
  setSurveyDetailTab,
  surveyDetails,
  detailsLoadingSurveyId,
  surveyEvents,
  eventsLoadingSurveyId,
  onLoadSurveyEvents,
  onTakePhoto,
  onPickPhoto,
  onDeleteAttachment,
  onDeleteSurvey,
  onSubmitSurvey,
  onRetrySurvey,
  onDiscardSurvey,
  onToggleVisibility,
  onOpenFactor,
  onRenameSurvey,
  onUpdateRegionVersion,
  onUpdateVegetationStage,
  onOpenParcels,
}: SurveyDetailScreenProps) {
  const { width: viewportWidth } = useWindowDimensions()
  const isHeroCompressedRef = useRef(false)
  const detail = surveyDetails[selectedSurvey.id]
  // Local survey state is the live source after user actions (submit / visibility toggle).
  const detailStatus = selectedSurvey.status
  const detailSubmittedAt = detail?.submitted_at ?? null
  const detailCreatedAt = detail?.created_at ?? selectedSurvey.created_at
  const detailExpiresAt = detail?.expires_at ?? null
  const submissionDeadline = resolveSubmissionDeadline(detailCreatedAt, detailExpiresAt)
  const remainingTime = formatRemainingTime(submissionDeadline)
  const isDraftNearDeadline =
    detailStatus === "draft" && isLessThan24HoursRemaining(submissionDeadline)
  const loadedEventCount = surveyEvents[selectedSurvey.id]?.length ?? 0
  const publishableOnPublicMap =
    detailStatus === "submitted" && selectedSurvey.visibility === "public"
  const photoAttachments = selectedSurveyAttachments.filter((attachment) =>
    Boolean(attachment.local_uri?.trim()),
  )
  const canonicalFactorEntries = useMemo(
    () =>
      detail
        ? Object.entries(detail.factor_results).sort(([left], [right]) => left.localeCompare(right))
        : [],
    [detail],
  )
  const [localDraftScores, setLocalDraftScores] = useState<DisplayedScores | null>(null)
  const [localDraftFactorEntries, setLocalDraftFactorEntries] = useState<
    Array<[string, DisplayedFactorResult]>
  >([])
  const [localSubmitReady, setLocalSubmitReady] = useState<boolean | null>(null)
  const [localMissingFactorCount, setLocalMissingFactorCount] = useState<number | null>(null)
  const [localDraftMeta, setLocalDraftMeta] = useState<LocalDraftMeta | null>(null)
  const [isRenamingSite, setIsRenamingSite] = useState(false)
  const [siteNameInput, setSiteNameInput] = useState("")
  const [isHeroCompressed, setIsHeroCompressed] = useState(false)
  const mediaSlideWidth = Math.max(viewportWidth - brandSpacing.md * 2, 0)
  const gpsCoordinates = useMemo(
    () => resolveDisplayCoordinates(detail?.display_location),
    [detail?.display_location],
  )
  const hasMapPreview = gpsCoordinates !== null
  const mapPreviewRegion = useMemo<Region>(() => {
    if (!gpsCoordinates) return DEFAULT_FRANCE_REGION
    return {
      latitude: gpsCoordinates.lat,
      longitude: gpsCoordinates.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }
  }, [gpsCoordinates])
  const mapPreviewZoom = useMemo(() => computeRegionZoom(mapPreviewRegion), [mapPreviewRegion])
  const { items: parcelStatuses } = useParcelStatuses({
    apiUrl,
    region: mapPreviewRegion,
    enabled: hasMapPreview,
    year: new Date().getFullYear(),
  })
  const photoSlides = useMemo<Array<{ key: string; attachment: LocalAttachment }>>(
    () => photoAttachments.map((attachment) => ({ key: `photo-${attachment.id}`, attachment })),
    [photoAttachments],
  )
  const hasPhotoSlides = photoSlides.length > 0
  const [mediaPageIndex, setMediaPageIndex] = useState(0)
  const [heroMode, setHeroMode] = useState<HeroMode>("map")

  useEffect(() => {
    setMediaPageIndex(0)
  }, [selectedSurvey.id, photoSlides.length])

  useEffect(() => {
    if (hasMapPreview) {
      setHeroMode("map")
      return
    }
    if (hasPhotoSlides) {
      setHeroMode("photo")
    }
  }, [selectedSurvey.id, hasMapPreview, hasPhotoSlides])

  useEffect(() => {
    let cancelled = false

    const run = async (): Promise<void> => {
      try {
        const draft = await getLocalSurveyDraft(selectedSurvey.id)
        if (!draft || cancelled) {
          if (!cancelled) {
            setLocalDraftScores(null)
            setLocalDraftFactorEntries([])
            setLocalSubmitReady(null)
            setLocalMissingFactorCount(null)
            setLocalDraftMeta(null)
          }
          return
        }

        const retained = computeRetainedScoresFromRawFactors(
          typeof draft.factors === "object" && draft.factors && !Array.isArray(draft.factors)
            ? draft.factors
            : {},
          draft.region_version,
          typeof draft.vegetation_stage === "string" ? draft.vegetation_stage : "",
        )

        const totals = computeIbpTotalsFromRetainedScores(retained)
        const regionVersion: RegionVersion = draft.region_version === "M" ? "M" : "ACA"
        const vegetationStage = normalizeVegetationStageForRegion(
          regionVersion,
          typeof draft.vegetation_stage === "string"
            ? draft.vegetation_stage
            : defaultVegetationStageForRegion(regionVersion),
        )
        const readiness = evaluateSubmitReadinessFromDraft({
          region_version: draft.region_version,
          vegetation_stage: draft.vegetation_stage,
          factors: draft.factors,
          parcel_ids: draft.parcel_ids,
          expires_at: draft.expires_at,
        })
        const entries = FACTOR_ORDER.map<[string, DisplayedFactorResult]>((factorCode) => {
          const score = retained[factorCode]
          return [
            factorCode,
            {
              selected_class: score?.selected_class ?? "Not filled",
              warnings: [],
            },
          ]
        })

        if (cancelled) return
        setLocalDraftScores({
          ibp_total: totals.ibp_total,
          ibp_peuplement_gestion: totals.ibp_peuplement_gestion,
          ibp_contexte: totals.ibp_contexte,
        })
        setLocalDraftFactorEntries(entries)
        setLocalSubmitReady(readiness.ready)
        setLocalMissingFactorCount(readiness.missing_factors.length)
        setLocalDraftMeta({
          site_name:
            typeof draft.site_name === "string" && draft.site_name.trim().length > 0
              ? draft.site_name
              : selectedSurvey.site_name,
          region_version: regionVersion,
          vegetation_stage: vegetationStage,
        })
      } catch (_error) {
        if (!cancelled) {
          setLocalDraftScores(null)
          setLocalDraftFactorEntries([])
          setLocalSubmitReady(null)
          setLocalMissingFactorCount(null)
          setLocalDraftMeta(null)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [selectedSurvey.id, selectedSurvey.site_name, selectedSurvey.updated_at])

  const useLocalDraftView = selectedSurvey.status !== "submitted" && localDraftScores !== null
  const displayedScores: DisplayedScores | null = useMemo(() => {
    if (useLocalDraftView && localDraftScores) {
      return localDraftScores
    }
    if (detail?.scores) {
      return detail.scores
    }
    return localDraftScores
  }, [useLocalDraftView, localDraftScores, detail?.scores])
  const displayedFactorEntries = useMemo<Array<[string, DisplayedFactorResult]>>(() => {
    if (useLocalDraftView && localDraftFactorEntries.length > 0) {
      return localDraftFactorEntries
    }
    if (canonicalFactorEntries.length > 0) {
      return canonicalFactorEntries as Array<[string, DisplayedFactorResult]>
    }
    return localDraftFactorEntries
  }, [useLocalDraftView, localDraftFactorEntries, canonicalFactorEntries])
  const showFactorLoadingHint =
    detailsLoadingSurveyId === selectedSurvey.id &&
    !displayedScores &&
    displayedFactorEntries.length === 0
  const canSubmitNow =
    selectedSurvey.sync_state === "synced" &&
    selectedSurvey.status !== "submitted" &&
    selectedSurvey.sync_blocked !== 1 &&
    localSubmitReady === true
  const completedFactorCountForSubmit =
    localMissingFactorCount === null ? null : 10 - localMissingFactorCount
  const canEditSurvey = selectedSurvey.status !== "submitted"
  const activeRegion: RegionVersion = useMemo(() => {
    if (localDraftMeta) return localDraftMeta.region_version
    return detail?.region_version === "M" ? "M" : "ACA"
  }, [localDraftMeta, detail?.region_version])
  const activeVegetationStage: VegetationStage = useMemo(() => {
    if (localDraftMeta) return localDraftMeta.vegetation_stage
    const fallback = defaultVegetationStageForRegion(activeRegion)
    return normalizeVegetationStageForRegion(
      activeRegion,
      typeof detail?.vegetation_stage === "string" ? detail.vegetation_stage : fallback,
    )
  }, [localDraftMeta, activeRegion, detail?.vegetation_stage])
  const activeSiteName =
    (localDraftMeta?.site_name ?? detail?.site_name ?? selectedSurvey.site_name).trim() ||
    selectedSurvey.site_name
  const activeRegionLabel =
    REGION_OPTIONS.find((option) => option.value === activeRegion)?.label ?? activeRegion
  const activeVegetationLabel =
    VEGETATION_STAGE_OPTIONS_BY_REGION[activeRegion].find(
      (option) => option.value === activeVegetationStage,
    )?.label ?? activeVegetationStage

  useEffect(() => {
    setIsRenamingSite(false)
    setSiteNameInput(activeSiteName)
  }, [selectedSurvey.id, activeSiteName])

  useEffect(() => {
    isHeroCompressedRef.current = false
    setIsHeroCompressed(false)
  }, [selectedSurvey.id])

  const handleAddPicture = (): void => {
    if (selectedSurvey.status === "submitted") {
      Alert.alert("Read-only survey", "This survey is submitted. Photo upload is disabled.")
      return
    }

    Alert.alert("Add picture", "Choose how to add a photo.", [
      {
        text: "Take photo",
        onPress: () => {
          void onTakePhoto(selectedSurvey.id)
        },
      },
      {
        text: "Choose from gallery",
        onPress: () => {
          void onPickPhoto(selectedSurvey.id)
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ])
  }

  const handleDeletePicture = (localAttachmentId: string): void => {
    if (selectedSurvey.status === "submitted") {
      Alert.alert("Read-only survey", "This survey is submitted. Photo deletion is disabled.")
      return
    }

    Alert.alert("Delete picture", "Remove this photo from the survey?", [
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void onDeleteAttachment(selectedSurvey.id, localAttachmentId)
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ])
  }

  const handleSaveSiteRename = (): void => {
    const nextName = siteNameInput.trim()
    if (!canEditSurvey) {
      return
    }
    if (!nextName) {
      Alert.alert("Invalid name", "Survey name cannot be empty.")
      return
    }
    void onRenameSurvey(selectedSurvey.id, nextName)
    setIsRenamingSite(false)
  }

  const handleOpenParcels = (): void => {
    if (!canEditSurvey) {
      return
    }
    void onOpenParcels(selectedSurvey.id)
  }

  const handleMediaScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (photoSlides.length <= 1) return
    const offsetX = event.nativeEvent.contentOffset.x
    const nextIndex = Math.round(offsetX / mediaSlideWidth)
    const safeIndex = Math.max(0, Math.min(photoSlides.length - 1, nextIndex))
    setMediaPageIndex(safeIndex)
  }
  const handleDetailScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const nextCompressed = event.nativeEvent.contentOffset.y > 56
    if (isHeroCompressedRef.current === nextCompressed) {
      return
    }
    isHeroCompressedRef.current = nextCompressed
    setIsHeroCompressed(nextCompressed)
  }
  const currentPhotoAttachment = hasPhotoSlides
    ? (photoSlides[Math.min(mediaPageIndex, photoSlides.length - 1)]?.attachment ?? null)
    : null
  const workflowStatus = resolveSurveyWorkflowStatus(selectedSurvey)
  const syncDisplay = resolveSurveySyncDisplay(selectedSurvey)
  const workflowStatusLabel = formatSurveyWorkflowStatusLabel(workflowStatus)
  const syncDisplayLabel = formatSurveySyncDisplayLabel(syncDisplay)
  const heroPrimaryMetricLabel = displayedScores
    ? useLocalDraftView
      ? "Local draft score"
      : "IBP total"
    : "Factors ready"
  const heroPrimaryMetricValue = displayedScores
    ? formatPoints(displayedScores.ibp_total)
    : completedFactorCountForSubmit !== null
      ? `${completedFactorCountForSubmit}/10`
      : "--"
  const completionRate = Math.max(0, Math.min(selectedSurvey.completion_rate, 100))
  const shouldShowCompressedHero = isHeroCompressed && !isRenamingSite
  const compactHeroSummary = `${workflowStatusLabel} · ${syncDisplayLabel}`
  const heroMetricMeta = displayedScores
    ? `P/G ${formatPoints(displayedScores.ibp_peuplement_gestion)} · C ${formatPoints(displayedScores.ibp_contexte)}`
    : completedFactorCountForSubmit !== null
      ? "Required factors completed"
      : "Submit readiness pending"
  const heroSubmitState =
    selectedSurvey.status === "submitted"
      ? "submitted"
      : canSubmitNow
        ? "ready"
        : localSubmitReady === true
          ? selectedSurvey.sync_blocked === 1
            ? "blocked"
            : "pending_sync"
          : "progress"
  const heroSubmitTitle =
    heroSubmitState === "ready"
      ? "Ready to submit"
      : heroSubmitState === "pending_sync"
        ? "Sync before submit"
        : heroSubmitState === "blocked"
          ? "Submission blocked"
          : "Submission locked"
  const heroSubmitBody =
    heroSubmitState === "ready"
      ? "All required factors and required fields are complete."
      : heroSubmitState === "pending_sync"
        ? "The survey is complete locally. Sync it before submission unlocks."
        : heroSubmitState === "blocked"
          ? "Resolve the sync issue before the submit action becomes available."
          : "All 10 factors must be completed before submission is allowed."
  const heroSubmitPillLabel =
    heroSubmitState === "ready"
      ? "Ready"
      : heroSubmitState === "pending_sync"
        ? "Sync first"
        : heroSubmitState === "blocked"
          ? "Blocked"
          : "Locked"
  const isSubmitReady = heroSubmitState === "ready"

  return (
    <ScrollView
      style={styles.mainScroll}
      contentContainerStyle={styles.detailScreenContent}
      onScroll={handleDetailScroll}
      scrollEventThrottle={16}
      stickyHeaderIndices={[0]}
    >
      <View style={styles.detailHeroStickyWrap}>
        <View
          style={[
            styles.detailHeroCard,
            shouldShowCompressedHero ? styles.detailHeroCardCompressed : null,
          ]}
        >
          <View style={styles.detailHeroAccentOrb} />
          {isRenamingSite ? (
            <View style={styles.detailRenameRow}>
              <TextInput
                style={styles.detailRenameInput}
                value={siteNameInput}
                onChangeText={setSiteNameInput}
                autoFocus
                placeholder="Survey name"
                placeholderTextColor="#D7E3C0"
              />
              <Pressable style={styles.detailRenameSaveButton} onPress={handleSaveSiteRename}>
                <Text style={styles.detailRenameSaveButtonText}>Save</Text>
              </Pressable>
              <Pressable
                style={styles.detailRenameCancelButton}
                onPress={() => {
                  setIsRenamingSite(false)
                  setSiteNameInput(activeSiteName)
                }}
              >
                <Text style={styles.detailRenameCancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          ) : shouldShowCompressedHero ? (
            <View style={styles.detailHeroCompactHeader}>
              <Pressable
                style={styles.detailHeroCompactCopy}
                onPress={() => {
                  if (!canEditSurvey) return
                  setIsRenamingSite(true)
                }}
              >
                <Text numberOfLines={1} style={styles.detailHeroCompactTitle}>
                  {activeSiteName}
                </Text>
                <Text numberOfLines={1} style={styles.detailHeroCompactMeta}>
                  {compactHeroSummary}
                </Text>
              </Pressable>

              <View style={styles.detailHeroCompactMetricPill}>
                <Text style={styles.detailHeroCompactMetricLabel}>{heroPrimaryMetricLabel}</Text>
                <Text style={styles.detailHeroCompactMetricValue}>{heroPrimaryMetricValue}</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.detailHeader}>
                <Pressable
                  style={styles.detailHeroCopy}
                  onPress={() => {
                    if (!canEditSurvey) return
                    setIsRenamingSite(true)
                  }}
                >
                  <Text style={styles.detailHeroEyebrow}>Survey detail</Text>
                  <Text style={styles.detailSurveyTitle}>{activeSiteName}</Text>
                  <View style={styles.detailHeroStatusRow}>
                    <View style={[styles.detailHeroStatusPill, styles.detailHeroStatusPillNeutral]}>
                      <Text style={styles.detailHeroStatusPillText}>{workflowStatusLabel}</Text>
                    </View>
                    <View
                      style={[
                        styles.detailHeroStatusPill,
                        syncDisplay === "sync"
                          ? styles.detailHeroStatusPillSuccess
                          : syncDisplay === "sync_error" || syncDisplay === "sync_blocked"
                            ? styles.detailHeroStatusPillDanger
                            : styles.detailHeroStatusPillNeutral,
                      ]}
                    >
                      <Text style={styles.detailHeroStatusPillText}>{syncDisplayLabel}</Text>
                    </View>
                    <View style={[styles.detailHeroStatusPill, styles.detailHeroStatusPillNeutral]}>
                      <Text style={styles.detailHeroStatusPillText}>
                        {selectedSurvey.visibility === "public" ? "Public" : "Private"}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <View style={styles.detailHeroMetricCard}>
                  <Text style={styles.detailHeroMetricLabel}>{heroPrimaryMetricLabel}</Text>
                  <Text style={styles.detailHeroMetricValue}>{heroPrimaryMetricValue}</Text>
                  <Text style={styles.detailHeroMetricMeta}>{heroMetricMeta}</Text>
                </View>
              </View>
            </>
          )}

          {heroSubmitState !== "ready" ? (
            <View
              style={[
                styles.detailHeroProgressCard,
                shouldShowCompressedHero ? styles.detailHeroProgressCardCompact : null,
              ]}
            >
              <View style={styles.detailHeroProgressHeader}>
                <Text style={styles.detailHeroProgressLabel}>Completion rate</Text>
                <Text style={styles.detailHeroProgressValue}>{completionRate}%</Text>
              </View>
              <View style={styles.detailHeroProgressTrack}>
                <View
                  style={[
                    styles.detailHeroProgressFill,
                    { width: completionRate === 0 ? 0 : `${completionRate}%` },
                  ]}
                />
              </View>
              {!shouldShowCompressedHero ? (
                <View style={styles.detailHeroProgressFooter}>
                  <View style={styles.heroMetaPill}>
                    <Ionicons name="time-outline" size={13} color="#D7E3C0" />
                    <Text style={styles.heroMetaText}>
                      Updated {formatDateTime(selectedSurvey.updated_at)}
                    </Text>
                  </View>
                  <View style={styles.heroMetaPill}>
                    <Ionicons name="images-outline" size={13} color="#D7E3C0" />
                    <Text style={styles.heroMetaText}>
                      {selectedSurveyAttachments.length} photo(s)
                    </Text>
                  </View>
                  {selectedSurvey.status !== "submitted" ? (
                    <View style={styles.heroMetaPill}>
                      <Ionicons name="hourglass-outline" size={13} color="#D7E3C0" />
                      <Text style={styles.heroMetaText}>{remainingTime}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {selectedSurvey.status !== "submitted" ? (
            isSubmitReady && shouldShowCompressedHero ? (
              <Pressable
                style={styles.detailHeroSubmitButtonCompact}
                onPress={() => void onSubmitSurvey(selectedSurvey.id)}
              >
                <Ionicons name="paper-plane-outline" size={15} color={brandColors.forest} />
                <Text style={styles.detailHeroSubmitButtonText}>Submit survey</Text>
              </Pressable>
            ) : (
              <View
                style={[
                  styles.detailHeroSubmitCard,
                  shouldShowCompressedHero ? styles.detailHeroSubmitCardCompact : null,
                  heroSubmitState === "ready"
                    ? styles.detailHeroSubmitCardReady
                    : heroSubmitState === "blocked"
                      ? styles.detailHeroSubmitCardBlocked
                      : heroSubmitState === "pending_sync"
                        ? styles.detailHeroSubmitCardPendingSync
                        : null,
                ]}
              >
                <View style={styles.detailHeroSubmitHeader}>
                  <View style={styles.detailHeroSubmitHeaderCopy}>
                    <Text style={styles.detailHeroSubmitTitle}>{heroSubmitTitle}</Text>
                    {!shouldShowCompressedHero ? (
                      <Text style={styles.detailHeroSubmitBody}>{heroSubmitBody}</Text>
                    ) : null}
                  </View>
                  {isSubmitReady ? (
                    <Pressable
                      style={styles.detailHeroSubmitButtonInline}
                      onPress={() => void onSubmitSurvey(selectedSurvey.id)}
                    >
                      <Ionicons name="paper-plane-outline" size={15} color={brandColors.forest} />
                      <Text style={styles.detailHeroSubmitButtonText}>Submit</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.detailHeroSubmitPill}>
                      <Text style={styles.detailHeroSubmitPillText}>{heroSubmitPillLabel}</Text>
                    </View>
                  )}
                </View>
              </View>
            )
          ) : null}
        </View>
      </View>

      {surveyDetailTab !== "debug" && (hasMapPreview || hasPhotoSlides || canEditSurvey) ? (
        <View style={styles.detailHeroShell}>
          {heroMode === "photo" && hasPhotoSlides ? (
            <View style={styles.detailHeroMain}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.detailHeroPhotoCarousel}
                decelerationRate="fast"
                snapToInterval={mediaSlideWidth}
                disableIntervalMomentum
                onMomentumScrollEnd={handleMediaScrollEnd}
              >
                {photoSlides.map((slide) => (
                  <View
                    key={slide.key}
                    style={[styles.detailHeroPhotoSlide, { width: mediaSlideWidth }]}
                  >
                    <Image
                      source={{ uri: slide.attachment.local_uri ?? undefined }}
                      style={styles.detailHeroPhotoImage}
                      resizeMode="cover"
                    />
                  </View>
                ))}
              </ScrollView>
              <View style={styles.detailHeroOverlayBadge}>
                <Ionicons name="images-outline" size={13} color={brandColors.white} />
                <Text style={styles.detailHeroOverlayBadgeText}>
                  Photos {mediaPageIndex + 1}/{photoSlides.length}
                </Text>
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.detailHeroMain}
              onPress={handleOpenParcels}
              disabled={!canEditSurvey}
            >
              <MapView
                style={styles.detailHeroMap}
                initialRegion={mapPreviewRegion}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <IgnCadastreTileOverlay enabled={mapPreviewZoom >= 15} zIndex={0} />
                <ParcelOverlayPolygons items={parcelStatuses} />
                {gpsCoordinates ? (
                  <Marker
                    coordinate={{ latitude: gpsCoordinates.lat, longitude: gpsCoordinates.lng }}
                  />
                ) : null}
              </MapView>
              <View style={styles.detailHeroOverlayBadge}>
                <Ionicons name="map-outline" size={13} color={brandColors.white} />
                <Text style={styles.detailHeroOverlayBadgeText}>
                  {canEditSurvey ? "Tap map to edit parcels" : "Map preview"}
                </Text>
              </View>
            </Pressable>
          )}

          {hasMapPreview && hasPhotoSlides ? (
            <Pressable
              style={styles.detailHeroSwitchThumb}
              onPress={() => setHeroMode(heroMode === "map" ? "photo" : "map")}
            >
              {heroMode === "map" ? (
                <Image
                  source={{ uri: photoSlides[0]?.attachment.local_uri ?? undefined }}
                  style={styles.detailHeroSwitchThumbImage}
                  resizeMode="cover"
                />
              ) : (
                <MapView
                  style={styles.detailHeroSwitchThumbMap}
                  initialRegion={mapPreviewRegion}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                >
                  {gpsCoordinates ? (
                    <Marker
                      coordinate={{ latitude: gpsCoordinates.lat, longitude: gpsCoordinates.lng }}
                    />
                  ) : null}
                </MapView>
              )}
              <View style={styles.detailHeroSwitchThumbLabel}>
                <Text style={styles.detailHeroSwitchThumbLabelText}>
                  {heroMode === "map" ? "Photos" : "Map"}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {selectedSurvey.status !== "submitted" ? (
            <View style={styles.detailHeroActions}>
              <Pressable style={styles.detailHeroActionButton} onPress={handleAddPicture}>
                <Ionicons name="camera-outline" size={16} color={brandColors.white} />
              </Pressable>
              {heroMode === "photo" && currentPhotoAttachment ? (
                <Pressable
                  style={[styles.detailHeroActionButton, styles.detailHeroActionButtonDanger]}
                  onPress={() => handleDeletePicture(currentPhotoAttachment.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={brandColors.white} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.filterChipsRow}>
        <SurfaceChip
          label="Summary"
          active={surveyDetailTab === "summary"}
          onPress={() => setSurveyDetailTab("summary")}
        />
        <SurfaceChip
          label="Events"
          active={surveyDetailTab === "events"}
          onPress={() => setSurveyDetailTab("events")}
        />
        <SurfaceChip
          label="Debug"
          active={surveyDetailTab === "debug"}
          onPress={() => setSurveyDetailTab("debug")}
        />
      </View>

      {surveyDetailTab === "summary" ? (
        <View style={styles.detailSection}>
          {selectedSurvey.status === "submitted" ? (
            <View style={styles.submittedReadonlyBanner}>
              <View style={styles.submittedReadonlyBannerHeader}>
                <Ionicons name="checkmark-done-circle" size={16} color={brandColors.forest} />
                <Text style={styles.submittedReadonlyBannerTitle}>Survey submitted</Text>
              </View>
              <Text style={styles.submittedReadonlyBannerText}>This record is now read-only.</Text>
            </View>
          ) : null}

          {selectedSurvey.status !== "submitted" ? (
            <View
              style={[styles.deadlineCard, isDraftNearDeadline ? styles.deadlineCardWarning : null]}
            >
              <Text style={styles.deadlineLabel}>Submission window</Text>
              <Text
                style={[
                  styles.deadlineValue,
                  isDraftNearDeadline ? styles.deadlineValueWarning : null,
                ]}
              >
                {remainingTime}
              </Text>
              <Text style={styles.rowMeta}>Deadline: {formatDateTime(submissionDeadline)}</Text>
              {isDraftNearDeadline ? (
                <Text style={styles.warningText}>Less than 24h left before survey expiration.</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.detailMetadataCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.detailTitle}>Context and parcels</Text>
                <Text style={styles.panelBody}>
                  Region version and vegetation stage used by the scoring rules.
                </Text>
              </View>
              {canEditSurvey ? (
                <Pressable style={styles.detailParcelsEditButton} onPress={handleOpenParcels}>
                  <Ionicons name="map-outline" size={14} color={brandColors.forest} />
                  <Text style={styles.detailParcelsEditButtonText}>Edit parcels</Text>
                </Pressable>
              ) : null}
            </View>

            {canEditSurvey ? (
              <>
                <View style={styles.filterChipsRow}>
                  {REGION_OPTIONS.map((option) => (
                    <SurfaceChip
                      key={`detail-region-${option.value}`}
                      label={option.label}
                      active={activeRegion === option.value}
                      onPress={() => {
                        void onUpdateRegionVersion(selectedSurvey.id, option.value)
                      }}
                    />
                  ))}
                </View>
                <View style={styles.filterChipsRow}>
                  {VEGETATION_STAGE_OPTIONS_BY_REGION[activeRegion].map((option) => (
                    <SurfaceChip
                      key={`detail-stage-${option.value}`}
                      label={option.label}
                      active={activeVegetationStage === option.value}
                      onPress={() => {
                        void onUpdateVegetationStage(selectedSurvey.id, option.value)
                      }}
                    />
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>Region: {activeRegionLabel}</Text>
                <Text style={styles.summaryItem}>Vegetation: {activeVegetationLabel}</Text>
              </View>
            )}
          </View>

          <View style={styles.factorTilesCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.detailTitle}>IBP scoring</Text>
                <Text style={styles.panelBody}>
                  Open factors to update observations and live scores.
                </Text>
              </View>
            </View>
            {showFactorLoadingHint ? <Text style={styles.rowMeta}>Loading factors...</Text> : null}
            {displayedScores ? (
              <>
                {useLocalDraftView ? (
                  <Text style={styles.rowMeta}>Showing local draft score from latest edits.</Text>
                ) : null}
                <View style={styles.scoreHeroCard}>
                  <Text style={styles.scoreHeroLabel}>IBP total</Text>
                  <Text style={styles.scoreHeroValue}>
                    {formatPoints(displayedScores.ibp_total)}
                  </Text>
                  <Text style={styles.scoreHeroMeta}>
                    P/G {formatPoints(displayedScores.ibp_peuplement_gestion)} · C{" "}
                    {formatPoints(displayedScores.ibp_contexte)}
                  </Text>
                </View>
                <View style={styles.factorTotalsRow}>
                  <View style={styles.factorTotalPill}>
                    <Text style={styles.factorTotalText}>
                      P/G {formatPoints(displayedScores.ibp_peuplement_gestion)}
                    </Text>
                  </View>
                  <View style={styles.factorTotalPill}>
                    <Text style={styles.factorTotalText}>
                      Context {formatPoints(displayedScores.ibp_contexte)}
                    </Text>
                  </View>
                </View>
                <View style={styles.factorTilesGrid}>
                  {displayedFactorEntries.map(([factorCode, factor]) => {
                    const factorCompleted = factor.selected_class !== "Not filled"

                    return (
                      <Pressable
                        key={`factor-tile-${factorCode}`}
                        style={[
                          styles.factorTile,
                          factorCompleted ? styles.factorTileCompleted : styles.factorTilePending,
                          canEditSurvey && isFactorKey(factorCode)
                            ? styles.factorTileEditable
                            : null,
                        ]}
                        onPress={() => {
                          if (!canEditSurvey || !isFactorKey(factorCode)) return
                          void onOpenFactor(selectedSurvey.id, factorCode)
                        }}
                      >
                        <View style={styles.factorTileTopRow}>
                          <View style={styles.factorTileIdentity}>
                            <View style={styles.factorBadge}>
                              <Text style={styles.factorBadgeText}>{factorCode}</Text>
                            </View>
                            <View
                              style={[
                                styles.factorTileIconWrap,
                                factorCompleted
                                  ? styles.factorTileIconWrapCompleted
                                  : styles.factorTileIconWrapPending,
                              ]}
                            >
                              <Ionicons
                                name={FACTOR_ICONS[factorCode] ?? "ellipse-outline"}
                                size={16}
                                color={
                                  factorCompleted ? brandColors.forest : brandColors.textSecondary
                                }
                              />
                            </View>
                          </View>
                          <View
                            style={[
                              styles.factorTileStatusPill,
                              factorCompleted
                                ? styles.factorTileStatusPillCompleted
                                : styles.factorTileStatusPillPending,
                            ]}
                          >
                            <Ionicons
                              name={factorCompleted ? "checkmark-circle" : "ellipse-outline"}
                              size={12}
                              color={
                                factorCompleted ? brandColors.forest : brandColors.textSecondary
                              }
                            />
                          </View>
                        </View>
                        <Text numberOfLines={2} style={styles.factorTileClass}>
                          {isFactorKey(factorCode)
                            ? FACTOR_TITLES[factorCode]
                            : `Factor ${factorCode}`}
                        </Text>
                        <Text
                          style={[
                            styles.factorTileCode,
                            factorCompleted
                              ? styles.factorTileClassCompleted
                              : styles.factorTileClassPending,
                          ]}
                        >
                          {factor.selected_class}
                        </Text>
                        {factor.warnings.length > 0 ? (
                          <Text style={styles.factorTileWarning}>Has warning</Text>
                        ) : null}
                      </Pressable>
                    )
                  })}
                </View>
              </>
            ) : (
              <Text style={styles.rowMeta}>Canonical factors not loaded yet.</Text>
            )}
          </View>

          <View style={styles.actionPanel}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.detailTitle}>Actions</Text>
                <Text style={styles.panelBody}>
                  Visibility, deletion and sync recovery controls.
                </Text>
              </View>
            </View>

            <View style={styles.actionButtonsRow}>
              <ActionButton
                label={selectedSurvey.visibility === "public" ? "Set private" : "Set public"}
                icon={
                  selectedSurvey.visibility === "public" ? "lock-closed-outline" : "globe-outline"
                }
                variant="neutral"
                onPress={() =>
                  void onToggleVisibility(
                    selectedSurvey.id,
                    selectedSurvey.visibility === "public" ? "private" : "public",
                  )
                }
              />
              <ActionButton
                label="Delete survey"
                icon="trash-outline"
                variant="danger"
                onPress={() => onDeleteSurvey(selectedSurvey.id)}
              />
            </View>

            {selectedSurvey.sync_state === "failed" ? (
              <View style={styles.actionButtonsRow}>
                <ActionButton
                  label="Retry now"
                  icon="refresh-outline"
                  variant="primary"
                  onPress={() => void onRetrySurvey(selectedSurvey.id)}
                />
                <ActionButton
                  label="Discard local change"
                  icon="close-circle-outline"
                  variant="danger"
                  onPress={() => void onDiscardSurvey(selectedSurvey.id)}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {surveyDetailTab === "events" ? (
        <View style={styles.detailSection}>
          <View style={styles.eventsCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.detailTitle}>Survey events</Text>
                <Text style={styles.panelBody}>Sync and workflow history for this record.</Text>
              </View>
              <ActionButton
                label="Reload"
                icon="refresh-outline"
                variant="neutral"
                onPress={() => void onLoadSurveyEvents(selectedSurvey.id)}
              />
            </View>
            {eventsLoadingSurveyId === selectedSurvey.id ? (
              <Text style={styles.rowMeta}>Loading events...</Text>
            ) : null}
            {(surveyEvents[selectedSurvey.id] ?? []).length === 0 &&
            eventsLoadingSurveyId !== selectedSurvey.id ? (
              <Text style={styles.rowMeta}>No events loaded yet.</Text>
            ) : null}
            {(surveyEvents[selectedSurvey.id] ?? []).map((event) => (
              <View key={event.id} style={styles.eventRow}>
                <Text style={styles.eventTitle}>{event.event_type}</Text>
                <Text style={styles.rowMeta}>{formatDateTime(event.created_at)}</Text>
                {formatEventPayload(event.payload) ? (
                  <Text style={styles.eventPayload}>{formatEventPayload(event.payload)}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {surveyDetailTab === "debug" ? (
        <View style={styles.detailSection}>
          <View style={styles.debugCard}>
            <Text style={styles.detailTitle}>Debug snapshot</Text>
            <Text style={styles.rowMeta}>id: {selectedSurvey.id}</Text>
            <Text style={styles.rowMeta}>updated: {selectedSurvey.updated_at}</Text>
            <Text style={styles.rowMeta}>created: {formatDateTime(detailCreatedAt)}</Text>
            <Text style={styles.rowMeta}>submitted at: {formatDateTime(detailSubmittedAt)}</Text>
            <Text style={styles.rowMeta}>
              publishable on public map: {publishableOnPublicMap ? "yes" : "no"}
            </Text>
            <Text style={styles.rowMeta}>completion: {selectedSurvey.completion_rate}%</Text>
            <Text style={styles.rowMeta}>history entries loaded: {loadedEventCount}</Text>
            <Text style={styles.rowMeta}>local photos: {selectedSurveyAttachments.length}</Text>
            {selectedSurvey.last_sync_error ? (
              <Text style={styles.rowMeta}>last error: {selectedSurvey.last_sync_error}</Text>
            ) : (
              <Text style={styles.rowMeta}>No sync error reported.</Text>
            )}
            {selectedSurvey.last_sync_error_code ? (
              <Text style={styles.rowMeta}>error code: {selectedSurvey.last_sync_error_code}</Text>
            ) : null}
            {selectedSurvey.last_sync_error_at ? (
              <Text style={styles.rowMeta}>error at: {selectedSurvey.last_sync_error_at}</Text>
            ) : null}
          </View>

          <View style={styles.debugAttachmentBlock}>
            <Text style={styles.debugSectionTitle}>Image debug</Text>
            {selectedSurveyAttachments.length === 0 ? (
              <Text style={styles.rowMeta}>No local attachment found.</Text>
            ) : (
              selectedSurveyAttachments.map((attachment, index) => (
                <View key={`debug-attachment-${attachment.id}`} style={styles.debugAttachmentCard}>
                  {attachment.local_uri ? (
                    <Image
                      source={{ uri: attachment.local_uri }}
                      style={styles.debugAttachmentPreview}
                    />
                  ) : (
                    <View style={styles.debugAttachmentPreviewPlaceholder}>
                      <Text style={styles.rowMeta}>No local preview</Text>
                    </View>
                  )}
                  <Text style={styles.rowMeta}>#{index + 1}</Text>
                  <Text style={styles.rowMeta}>id: {attachment.id}</Text>
                  <Text style={styles.rowMeta}>survey_id: {attachment.survey_id}</Text>
                  <Text style={styles.rowMeta}>local_uri: {attachment.local_uri}</Text>
                  <Text style={styles.rowMeta}>mime_type: {attachment.mime_type}</Text>
                  <Text style={styles.rowMeta}>
                    size: {attachment.size_bytes} bytes ({Math.round(attachment.size_bytes / 1024)}{" "}
                    KB)
                  </Text>
                  <Text style={styles.rowMeta}>sync_state: {attachment.sync_state}</Text>
                  <Text style={styles.rowMeta}>
                    remote_attachment_id: {attachment.remote_attachment_id ?? "null"}
                  </Text>
                  <Text style={styles.rowMeta}>
                    storage_key: {attachment.storage_key ?? "null"}
                  </Text>
                  <Text style={styles.rowMeta}>upload_url: {attachment.upload_url ?? "null"}</Text>
                  <Text style={styles.rowMeta}>
                    confirm_url: {attachment.confirm_url ?? "null"}
                  </Text>
                  <Text style={styles.rowMeta}>updated_at: {attachment.updated_at}</Text>
                  <Text style={styles.rowMeta}>
                    last_sync_error_code: {attachment.last_sync_error_code ?? "null"}
                  </Text>
                  <Text style={styles.rowMeta}>
                    last_sync_error: {attachment.last_sync_error ?? "null"}
                  </Text>
                  <Text style={styles.rowMeta}>
                    last_sync_error_at: {attachment.last_sync_error_at ?? "null"}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  mainScroll: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },
  detailScreenContent: {
    padding: brandSpacing.md,
    gap: brandSpacing.md,
    paddingBottom: 120,
  },
  detailHeroStickyWrap: {
    backgroundColor: brandColors.canvas,
  },
  detailHeroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    backgroundColor: brandColors.forest,
    padding: 20,
    gap: 12,
    ...brandShadow.card,
  },
  detailHeroCardCompressed: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  detailHeroAccentOrb: {
    position: "absolute",
    top: -24,
    right: -18,
    width: 138,
    height: 138,
    borderRadius: 999,
    backgroundColor: "rgba(176, 199, 142, 0.22)",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  detailHeroCopy: {
    flex: 1,
    gap: 8,
  },
  detailHeroEyebrow: {
    ...brandTypography.heroEyebrow,
    color: "#D7E3C0",
  },
  detailSurveyTitle: {
    ...brandTypography.heroTitle,
    color: brandColors.white,
  },
  detailHeroMetricCard: {
    minWidth: 116,
    maxWidth: 144,
    borderRadius: 24,
    backgroundColor: "rgba(247, 246, 240, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  detailHeroMetricLabel: {
    ...brandTypography.heroEyebrow,
    color: "#D7E3C0",
  },
  detailHeroMetricValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    color: brandColors.white,
  },
  detailHeroMetricMeta: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  detailHeroCompactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailHeroCompactCopy: {
    flex: 1,
    gap: 4,
  },
  detailHeroCompactTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 24,
    lineHeight: 27,
    color: brandColors.white,
  },
  detailHeroCompactMeta: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  detailHeroCompactMetricPill: {
    minWidth: 92,
    borderRadius: brandRadius.card,
    backgroundColor: "rgba(247, 246, 240, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "flex-end",
    gap: 2,
  },
  detailHeroCompactMetricLabel: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  detailHeroCompactMetricValue: {
    ...brandTypography.label,
    fontSize: 18,
    lineHeight: 21,
    color: brandColors.white,
  },
  detailRenameRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  detailRenameInput: {
    flex: 1,
    minWidth: 160,
    borderRadius: brandRadius.field,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: brandColors.white,
    ...brandTypography.input,
  },
  detailRenameSaveButton: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.sage,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailRenameSaveButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  detailRenameCancelButton: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailRenameCancelButtonText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  detailHeroStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  detailHeroStatusPill: {
    borderRadius: brandRadius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
  },
  detailHeroStatusPillNeutral: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(247, 246, 240, 0.1)",
  },
  detailHeroStatusPillSuccess: {
    borderColor: "rgba(187,208,155,0.28)",
    backgroundColor: "rgba(176,199,142,0.18)",
  },
  detailHeroStatusPillDanger: {
    borderColor: "rgba(228,165,149,0.28)",
    backgroundColor: "rgba(205,88,51,0.14)",
  },
  detailHeroStatusPillText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroMetaText: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  detailHeroProgressCard: {
    gap: 8,
    borderRadius: 22,
    backgroundColor: "rgba(247, 246, 240, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailHeroProgressCardCompact: {
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailHeroProgressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailHeroProgressLabel: {
    ...brandTypography.heroEyebrow,
    color: "#D7E3C0",
  },
  detailHeroProgressValue: {
    ...brandTypography.label,
    color: brandColors.white,
  },
  detailHeroProgressTrack: {
    height: 10,
    overflow: "hidden",
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  detailHeroProgressFill: {
    height: "100%",
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.sage,
  },
  detailHeroProgressFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailHeroSubmitCard: {
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(247, 246, 240, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailHeroSubmitCardCompact: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailHeroSubmitCardReady: {
    borderColor: "rgba(208, 226, 182, 0.34)",
    backgroundColor: "rgba(176, 199, 142, 0.18)",
  },
  detailHeroSubmitCardPendingSync: {
    borderColor: "rgba(231, 194, 129, 0.34)",
    backgroundColor: "rgba(204, 112, 31, 0.12)",
  },
  detailHeroSubmitCardBlocked: {
    borderColor: "rgba(228, 165, 149, 0.34)",
    backgroundColor: "rgba(205, 88, 51, 0.12)",
  },
  detailHeroSubmitHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  detailHeroSubmitHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  detailHeroSubmitTitle: {
    ...brandTypography.label,
    color: brandColors.white,
  },
  detailHeroSubmitBody: {
    ...brandTypography.meta,
    color: "#D7E3C0",
  },
  detailHeroSubmitPill: {
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  detailHeroSubmitPillText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  detailHeroSubmitButtonInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.white,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  detailHeroSubmitButtonCompact: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailHeroSubmitButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  detailHeroShell: {
    position: "relative",
    minHeight: 320,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: "#132434",
    ...brandShadow.card,
  },
  detailHeroMain: {
    width: "100%",
    height: 320,
    backgroundColor: "#132434",
  },
  detailHeroMap: {
    width: "100%",
    height: "100%",
    backgroundColor: "#132434",
  },
  detailHeroPhotoCarousel: {
    width: "100%",
    height: "100%",
  },
  detailHeroPhotoSlide: {
    height: "100%",
  },
  detailHeroPhotoImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#132434",
  },
  detailHeroOverlayBadge: {
    position: "absolute",
    left: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(8, 13, 19, 0.72)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailHeroOverlayBadgeText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  detailHeroSwitchThumb: {
    position: "absolute",
    left: 14,
    top: 14,
    width: 78,
    height: 78,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "#132434",
  },
  detailHeroSwitchThumbImage: {
    width: "100%",
    height: "100%",
  },
  detailHeroSwitchThumbMap: {
    width: "100%",
    height: "100%",
  },
  detailHeroSwitchThumbLabel: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(8, 13, 19, 0.72)",
    paddingVertical: 4,
  },
  detailHeroSwitchThumbLabelText: {
    ...brandTypography.meta,
    color: brandColors.white,
    textAlign: "center",
  },
  detailHeroActions: {
    position: "absolute",
    top: 14,
    right: 14,
    gap: 8,
  },
  detailHeroActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(8, 13, 19, 0.72)",
  },
  detailHeroActionButtonDanger: {
    backgroundColor: "rgba(129, 31, 31, 0.84)",
    borderColor: "rgba(255, 210, 210, 0.42)",
  },
  filterChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest,
  },
  filterChipStatic: {
    opacity: 1,
  },
  filterChipSuccess: {
    backgroundColor: brandColors.successSoft,
    borderColor: "#BBD09B",
  },
  filterChipWarning: {
    backgroundColor: "#F7E6CA",
    borderColor: "#E7C281",
  },
  filterChipDanger: {
    backgroundColor: brandColors.errorSoft,
    borderColor: "#E4A595",
  },
  filterChipText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  filterChipTextActive: {
    color: brandColors.white,
  },
  detailSection: {
    gap: 12,
  },
  detailMetadataCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 12,
    ...brandShadow.card,
  },
  detailTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 22,
    lineHeight: 25,
    color: brandColors.forest,
  },
  panelBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  detailParcelsEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailParcelsEditButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryItem: {
    ...brandTypography.meta,
    color: brandColors.forest,
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scoreHeroCard: {
    borderRadius: 24,
    backgroundColor: brandColors.successSoft,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  scoreHeroLabel: {
    ...brandTypography.heroEyebrow,
    color: brandColors.textSecondary,
  },
  scoreHeroValue: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    color: brandColors.forest,
  },
  scoreHeroMeta: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  factorTilesCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 12,
    ...brandShadow.card,
  },
  factorTotalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  factorTotalPill: {
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  factorTotalText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  factorTilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  factorTile: {
    width: "31%",
    minWidth: 98,
    flexGrow: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  factorTileCompleted: {
    borderColor: "#B8CFA4",
    backgroundColor: brandColors.successSoft,
  },
  factorTilePending: {
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
  },
  factorTileEditable: {
    borderColor: brandColors.divider,
  },
  factorTileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  factorTileIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  factorBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.forest,
  },
  factorBadgeText: {
    ...brandTypography.label,
    fontSize: 12,
    lineHeight: 14,
    color: brandColors.white,
  },
  factorTileIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
  },
  factorTileIconWrapCompleted: {
    backgroundColor: brandColors.panelMuted,
  },
  factorTileIconWrapPending: {
    backgroundColor: brandColors.panelMuted,
  },
  factorTileClass: {
    ...brandTypography.label,
    fontSize: 13,
    lineHeight: 16,
    color: brandColors.textPrimary,
  },
  factorTileCode: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  factorTileClassCompleted: {
    color: brandColors.forest,
  },
  factorTileClassPending: {
    color: brandColors.textSecondary,
  },
  factorTileStatusPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  factorTileStatusPillCompleted: {
    backgroundColor: "#DCE7C4",
  },
  factorTileStatusPillPending: {
    backgroundColor: brandColors.panelMuted,
  },
  factorTileWarning: {
    ...brandTypography.meta,
    color: brandColors.terracotta,
  },
  actionPanel: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 12,
    ...brandShadow.card,
  },
  actionButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: brandRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
  },
  actionButtonNeutral: {
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
  },
  actionButtonPrimary: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest,
  },
  actionButtonDanger: {
    borderColor: "#E2A495",
    backgroundColor: brandColors.errorSoft,
  },
  actionButtonSuccess: {
    borderColor: "#BBD09B",
    backgroundColor: brandColors.successSoft,
  },
  actionButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  actionButtonTextPrimary: {
    color: brandColors.white,
  },
  actionButtonTextDanger: {
    color: brandColors.terracotta,
  },
  submittedReadonlyBanner: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#BBD09B",
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 8,
  },
  submittedReadonlyBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submittedReadonlyBannerTitle: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  submittedReadonlyBannerText: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  deadlineCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 6,
  },
  deadlineCardWarning: {
    borderColor: "#E7C281",
    backgroundColor: "#FDF2DF",
  },
  deadlineLabel: {
    ...brandTypography.heroEyebrow,
    color: brandColors.textSecondary,
  },
  deadlineValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
    color: brandColors.forest,
  },
  deadlineValueWarning: {
    color: brandColors.ochre,
  },
  rowMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  warningText: {
    ...brandTypography.meta,
    color: brandColors.ochre,
  },
  eventsCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 12,
    ...brandShadow.card,
  },
  eventRow: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: brandColors.divider,
    paddingTop: 12,
  },
  eventTitle: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  eventPayload: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  debugCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 18,
    gap: 6,
    ...brandShadow.card,
  },
  debugAttachmentBlock: {
    gap: 10,
  },
  debugSectionTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 22,
    lineHeight: 25,
    color: brandColors.forest,
  },
  debugAttachmentCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 14,
    gap: 6,
  },
  debugAttachmentPreview: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    backgroundColor: brandColors.panelMuted,
  },
  debugAttachmentPreviewPlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
  },
})
