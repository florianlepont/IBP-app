import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactElement } from "react"
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ListRenderItemInfo,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  brandColors,
  brandComponentTokens,
  brandRadius,
  brandSemanticColors,
  brandShadow,
  brandSpacing,
  brandTypography,
} from "../app/brand-tokens"
import { formatShortDateTime, formatSyncErrorForUser } from "../app/formatters"
import {
  computeSurveyStats,
  formatSurveyUiStatusLabel,
  resolveSurveyUiStatus,
} from "../app/survey-logic"
import {
  SurveyAttachmentFilter,
  SurveyBlockedFilter,
  SurveySort,
  SurveyStatusFilter,
  SurveyVisibilityFilter,
  SurveySyncFilter,
} from "../app/types"
import { useAppBottomTabBarHeight } from "../app/useAppBottomTabBarHeight"
import { LocalAttachment, LocalSurvey } from "../storage"
import {
  isPhotoAttachment,
  resolveAttachmentPreview,
  selectPreviewCandidates,
} from "./survey-screen-helpers"
import { triggerHaptic } from "./survey-list/haptics"
import { SurveyRow } from "./survey-list/SurveyRow"
import type { SurveyRowPreview } from "./survey-list/SurveyRow"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppChoiceChip } from "../ui/AppChoiceChip"
import { AppField } from "../ui/AppField"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { BrandBump } from "../ui/BrandBump"

// P3-LAYOUT-01: reserve enough room so the round logo never collides with copy
const HERO_ORNAMENT_EXCLUSION = 92
const HERO_EXPANDED_PADDING_TOP = 16
const HERO_EXPANDED_PADDING_BOTTOM = 14
const HERO_EXPANDED_CONTENT_GAP = 14
const PAGE_CONTENT_GAP = 10

// ─── Types ────────────────────────────────────────────────────────────────────

type SurveyListScreenProps = {
  surveys: LocalSurvey[]
  visibleSurveys: LocalSurvey[]
  selectedSurveyId: string | null
  attachmentsBySurvey: Record<string, LocalAttachment[]>
  surveyQuery: string
  setSurveyQuery: (value: string) => void
  surveyFromDate: string
  setSurveyFromDate: (value: string) => void
  surveyToDate: string
  setSurveyToDate: (value: string) => void
  statusFilter: SurveyStatusFilter
  setStatusFilter: (value: SurveyStatusFilter) => void
  visibilityFilter: SurveyVisibilityFilter
  setVisibilityFilter: (value: SurveyVisibilityFilter) => void
  syncFilter: SurveySyncFilter
  setSyncFilter: (value: SurveySyncFilter) => void
  blockedFilter: SurveyBlockedFilter
  setBlockedFilter: (value: SurveyBlockedFilter) => void
  attachmentFilter: SurveyAttachmentFilter
  setAttachmentFilter: (value: SurveyAttachmentFilter) => void
  sortMode: SurveySort
  setSortMode: (value: SurveySort) => void
  resetFilters: () => void
  useNativeSearchUI?: boolean
  showInlineSearch?: boolean
  onRefresh?: () => Promise<void>
  onDeleteSurvey: (surveyId: string) => void
  onOpenCreateSurvey: () => void
  onOpenSurvey: (surveyId: string) => void
  onEnsureAttachmentPreviews?: (attachments: LocalAttachment[]) => Promise<void> | void
}

// A non-survey item at the top of the list (create card, "À faire" card, section header).
type LeadingListItem = { kind: "leading"; key: string; element: ReactElement }
type SurveyListItem = LeadingListItem | LocalSurvey

function isLeadingListItem(item: SurveyListItem): item is LeadingListItem {
  return "kind" in item && item.kind === "leading"
}

const keyExtractor = (item: SurveyListItem): string =>
  isLeadingListItem(item) ? `leading:${item.key}` : item.id

// D-03: rows mounted on the first render and per batch; the leading items come on top.
const INITIAL_ROWS = 10
const STICKY_HEADER_INDICES = [0]

// P3-PERSON-05: severity prop for visual differentiation
type SurveyStatTileProps = {
  label: string
  value: string
  severity?: "neutral" | "warning" | "danger"
  onPress: () => void
  accessibilityLabel: string
}

// ─── Filter options (French) ──────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ label: string; value: SurveyStatusFilter }> = [
  { label: "Tous", value: "all" },
  { label: "Brouillon", value: "draft" },
  { label: "Soumis", value: "submitted" },
  { label: "Expiré", value: "expired" },
]

const SYNC_OPTIONS: Array<{ label: string; value: SurveySyncFilter }> = [
  { label: "Tous", value: "all" },
  { label: "En attente", value: "pending" },
  { label: "Synchronisé", value: "synced" },
  { label: "Erreur", value: "failed" },
]

const BLOCKED_OPTIONS: Array<{ label: string; value: SurveyBlockedFilter }> = [
  { label: "Tous", value: "all" },
  { label: "Bloqués", value: "blocked" },
  { label: "Non bloqués", value: "unblocked" },
]

const ATTACHMENT_OPTIONS: Array<{ label: string; value: SurveyAttachmentFilter }> = [
  { label: "Tous", value: "all" },
  { label: "Avec photo", value: "with" },
  { label: "Sans photo", value: "without" },
]

const SORT_OPTIONS: Array<{ label: string; value: SurveySort }> = [
  { label: "Récent en premier", value: "updated_desc" },
  { label: "Ancien en premier", value: "updated_asc" },
  { label: "Site A-Z", value: "site_asc" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveAttentionStyle(uiStatus: ReturnType<typeof resolveSurveyUiStatus>): {
  bg: string
  iconName: keyof typeof Ionicons.glyphMap
  iconColor: string
} {
  if (uiStatus === "sync_blocked" || uiStatus === "sync_error") {
    return {
      bg: brandColors.errorSoft,
      iconName: "alert-circle",
      iconColor: brandColors.terracotta,
    }
  }
  if (uiStatus === "expired") {
    return { bg: brandColors.warningSoft, iconName: "time", iconColor: brandColors.ochre }
  }
  return {
    bg: brandColors.panel,
    iconName: "information-circle",
    iconColor: brandColors.textSecondary,
  }
}

function parseSurveyDate(value: string): number {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function resolveAttentionPriority(uiStatus: ReturnType<typeof resolveSurveyUiStatus>): number {
  if (uiStatus === "sync_blocked") return 0
  if (uiStatus === "sync_error") return 1
  if (uiStatus === "expired") return 2
  return 3
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// P3-PERSON-05: severity tint + P1-A11Y-01: funnel affordance
function SurveyStatTile({
  label,
  value,
  severity = "neutral",
  onPress,
  accessibilityLabel,
}: SurveyStatTileProps) {
  const chipBg =
    severity === "danger"
      ? "rgba(205,88,51,0.20)"
      : severity === "warning"
        ? "rgba(204,112,31,0.20)"
        : brandSemanticColors.heroPanelBackgroundOnDark
  const chipBorder =
    severity === "danger"
      ? "rgba(205,88,51,0.40)"
      : severity === "warning"
        ? "rgba(204,112,31,0.40)"
        : brandSemanticColors.heroPanelBorderOnDark

  return (
    <Pressable
      onPress={() => {
        triggerHaptic()
        onPress()
      }}
      style={({ pressed }) => [pressed && styles.statTilePressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.statTile, { backgroundColor: chipBg, borderColor: chipBorder }]}>
        <Text style={styles.statTileText}>
          {value} {label}
        </Text>
        {/* P1-A11Y-01: subtle funnel affordance hinting the tile is interactive */}
        <Ionicons name="funnel-outline" size={9} color="rgba(255,255,255,0.50)" />
      </View>
    </Pressable>
  )
}

function FilterSection<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ label: string; value: T }>
  value: T
  onChange: (next: T) => void
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionLabel}>{label}</Text>
      <View style={styles.filterChipRow}>
        {options.map((option) => (
          <AppChoiceChip
            key={option.value}
            label={option.label}
            active={value === option.value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SurveyListScreen({
  surveys,
  visibleSurveys,
  selectedSurveyId,
  attachmentsBySurvey,
  surveyQuery,
  setSurveyQuery,
  surveyFromDate,
  setSurveyFromDate,
  surveyToDate,
  setSurveyToDate,
  statusFilter,
  setStatusFilter,
  visibilityFilter: _visibilityFilter,
  setVisibilityFilter: _setVisibilityFilter,
  syncFilter,
  setSyncFilter,
  blockedFilter,
  setBlockedFilter,
  attachmentFilter,
  setAttachmentFilter,
  sortMode,
  setSortMode,
  resetFilters,
  useNativeSearchUI = false,
  showInlineSearch = true,
  onRefresh,
  onDeleteSurvey,
  onOpenCreateSurvey,
  onOpenSurvey,
  onEnsureAttachmentPreviews,
}: SurveyListScreenProps) {
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [heroExpandedHeaderHeight, setHeroExpandedHeaderHeight] = useState(0)
  const [heroStatsRowHeight, setHeroStatsRowHeight] = useState(0)
  const scrollY = useRef(new Animated.Value(0)).current
  const { height: viewportHeight, width: windowWidth } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useAppBottomTabBarHeight(Platform.select({ ios: 84, default: 68 }) ?? 68)
  const trimmedQuery = surveyQuery.trim()
  const showHero = !useNativeSearchUI
  const showFiltersPanel = useNativeSearchUI || showInlineSearch

  // Hero card inner width (for BrandBump)
  const heroCardWidth = windowWidth - 32 // 16pt padding each side

  // ── Computed stats ──────────────────────────────────────────────────────────

  const surveyStats = useMemo(() => computeSurveyStats(surveys), [surveys])

  const advancedFilterCount = useMemo(() => {
    let count = 0
    if (surveyFromDate.trim()) count += 1
    if (surveyToDate.trim()) count += 1
    if (syncFilter !== "all") count += 1
    if (blockedFilter !== "all") count += 1
    if (attachmentFilter !== "all") count += 1
    if (sortMode !== "updated_desc") count += 1
    return count
  }, [attachmentFilter, blockedFilter, sortMode, surveyFromDate, surveyToDate, syncFilter])

  const totalFilterCount = useMemo(() => {
    return advancedFilterCount + (statusFilter !== "all" ? 1 : 0)
  }, [advancedFilterCount, statusFilter])

  // ── Featured cards content ──────────────────────────────────────────────────

  const continueDraftSurvey = useMemo(() => {
    const candidates = [...surveys].filter(
      (survey) => survey.status !== "submitted" && survey.status !== "expired",
    )
    candidates.sort((a, b) => parseSurveyDate(b.updated_at) - parseSurveyDate(a.updated_at))
    return candidates[0] ?? null
  }, [surveys])

  const attentionSurveys = useMemo(() => {
    const items = surveys
      .filter((survey) => {
        const uiStatus = resolveSurveyUiStatus(survey)
        return uiStatus === "sync_blocked" || uiStatus === "sync_error" || uiStatus === "expired"
      })
      .filter((survey) => survey.id !== continueDraftSurvey?.id)

    items.sort((left, right) => {
      const leftStatus = resolveSurveyUiStatus(left)
      const rightStatus = resolveSurveyUiStatus(right)
      const priorityDelta =
        resolveAttentionPriority(leftStatus) - resolveAttentionPriority(rightStatus)
      if (priorityDelta !== 0) return priorityDelta
      return parseSurveyDate(right.updated_at) - parseSurveyDate(left.updated_at)
    })

    return items.slice(0, 3)
  }, [continueDraftSurvey?.id, surveys])

  // Show max 2 attention rows inline, "voir N autres" if more
  const visibleAttentionSurveys = useMemo(() => attentionSurveys.slice(0, 2), [attentionSurveys])
  const hiddenAttentionCount = attentionSurveys.length - visibleAttentionSurveys.length

  // ── Main list — deduplicated ────────────────────────────────────────────────

  const excludedIds = useMemo(() => {
    const ids = new Set<string>()
    if (continueDraftSurvey) ids.add(continueDraftSurvey.id)
    attentionSurveys.forEach((s) => ids.add(s.id))
    return ids
  }, [continueDraftSurvey, attentionSurveys])

  const mainListSurveys = useMemo(
    () => (showHero ? visibleSurveys.filter((s) => !excludedIds.has(s.id)) : visibleSurveys),
    [showHero, visibleSurveys, excludedIds],
  )

  // D-11: ask for the first photo of every visible survey so a pulled ("remote")
  // attachment downloads on demand instead of staying hidden in the list.
  const firstPhotoPerVisibleSurveyKey = visibleSurveys
    .map((survey) => {
      const firstPhoto = (attachmentsBySurvey[survey.id] ?? []).find(isPhotoAttachment)
      return firstPhoto ? `${firstPhoto.id}:${firstPhoto.file_state}` : null
    })
    .filter((key): key is string => key !== null)
    .join(",")

  useEffect(() => {
    const candidates = visibleSurveys
      .map((survey) => (attachmentsBySurvey[survey.id] ?? []).find(isPhotoAttachment))
      .filter((attachment): attachment is LocalAttachment => Boolean(attachment))
    void onEnsureAttachmentPreviews?.(selectPreviewCandidates(candidates))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPhotoPerVisibleSurveyKey, onEnsureAttachmentPreviews])

  // ── Summary labels ──────────────────────────────────────────────────────────

  const visibleSurveySummary = useMemo(() => {
    if (surveys.length === 0) return "Aucun relevé local"
    if (trimmedQuery.length > 0) {
      return `${visibleSurveys.length} résultat${visibleSurveys.length > 1 ? "s" : ""} pour « ${trimmedQuery} »`
    }
    if (visibleSurveys.length === surveys.length) {
      return `${visibleSurveys.length} relevé${visibleSurveys.length > 1 ? "s" : ""} affiché${visibleSurveys.length > 1 ? "s" : ""}`
    }
    return `${visibleSurveys.length} sur ${surveys.length} relevés affichés`
  }, [surveys.length, trimmedQuery, visibleSurveys.length])

  const filtersSummaryLabel = useMemo(
    () =>
      totalFilterCount > 0
        ? `${totalFilterCount} filtre${totalFilterCount > 1 ? "s" : ""} actif${totalFilterCount > 1 ? "s" : ""}`
        : visibleSurveySummary,
    [totalFilterCount, visibleSurveySummary],
  )

  const compactSummary = useMemo(() => {
    if (totalFilterCount > 0) {
      return `${visibleSurveys.length} sur ${surveys.length} affichés • ${totalFilterCount} filtre${totalFilterCount > 1 ? "s" : ""} actif${totalFilterCount > 1 ? "s" : ""}`
    }
    return `${surveyStats.total} relevés • ${surveyStats.draft} brouillons • ${surveyStats.pending} en attente`
  }, [
    totalFilterCount,
    visibleSurveys.length,
    surveys.length,
    surveyStats.total,
    surveyStats.draft,
    surveyStats.pending,
  ])

  const createSurveyCardCopy = useMemo(
    () =>
      surveys.length === 0
        ? {
            badge: "Premier relevé",
            title: "Créez votre premier relevé",
            body: "Commencez votre carnet de terrain IBP en quelques étapes.",
            actionLabel: "Commencer",
            accessibilityLabel: "Créer votre premier relevé",
          }
        : {
            badge: "Nouveau relevé",
            title: "Créer un nouveau relevé",
            body: "Ajoutez un relevé IBP à votre carnet de terrain.",
            actionLabel: "Créer",
            accessibilityLabel: "Créer un nouveau relevé",
          },
    [surveys.length],
  )

  const heroEyebrow = "ACCUEIL"

  // ── P2-GLANCE-03: Dynamic hero body ────────────────────────────────────────

  const heroBodyText = useMemo(() => {
    if (surveys.length === 0) return "Commencez votre premier relevé IBP."
    if (surveyStats.blocked > 0)
      return `${surveyStats.blocked} relevé${surveyStats.blocked > 1 ? "s" : ""} nécessite${surveyStats.blocked > 1 ? "nt" : ""} votre attention.`
    if (attentionSurveys.length > 0)
      return `${attentionSurveys.length} relevé${attentionSurveys.length > 1 ? "s" : ""} à examiner.`
    if (continueDraftSurvey) return `${continueDraftSurvey.site_name} vous attend.`
    if (surveyStats.submitted > 0 && surveyStats.draft === 0) return "Tous vos relevés sont à jour."
    return "Retrouvez vos relevés et reprenez où vous vous êtes arrêté."
  }, [surveys.length, surveyStats, attentionSurveys.length, continueDraftSurvey])

  // ── P3-PERSON-05: Hero stat tiles with severity ─────────────────────────────

  const heroStats = useMemo(
    () => [
      {
        label: "relevés",
        value: String(surveyStats.total),
        severity: "neutral" as const,
        onPress: resetFilters,
        accessibilityLabel: `${surveyStats.total} relevés au total — appuyer pour tout afficher`,
      },
      {
        label: "brouillons",
        value: String(surveyStats.draft),
        severity: "neutral" as const,
        onPress: () => setStatusFilter("draft"),
        accessibilityLabel: `${surveyStats.draft} brouillons — appuyer pour filtrer`,
      },
      {
        label: "en attente",
        value: String(surveyStats.pending),
        severity: (surveyStats.pending > 0 ? "warning" : "neutral") as
          | "neutral"
          | "warning"
          | "danger",
        onPress: () => setSyncFilter("pending"),
        accessibilityLabel: `${surveyStats.pending} en attente de sync — appuyer pour filtrer`,
      },
      surveyStats.blocked > 0
        ? {
            label: "bloqués",
            value: String(surveyStats.blocked),
            severity: "danger" as const,
            onPress: () => setBlockedFilter("blocked"),
            accessibilityLabel: `${surveyStats.blocked} relevés bloqués — appuyer pour filtrer`,
          }
        : {
            label: "soumis",
            value: String(surveyStats.submitted),
            severity: "neutral" as const,
            onPress: () => setStatusFilter("submitted"),
            accessibilityLabel: `${surveyStats.submitted} relevés soumis — appuyer pour filtrer`,
          },
    ],
    [surveyStats, resetFilters, setStatusFilter, setSyncFilter, setBlockedFilter],
  )

  // ── P1-GLANCE-01: Reduced hero height ──────────────────────────────────────

  const baseExpandedHeroHeight = Math.max(190, Math.min(215, Math.round(viewportHeight * 0.22)))
  const measuredExpandedHeroHeight =
    heroExpandedHeaderHeight > 0 && heroStatsRowHeight > 0
      ? HERO_EXPANDED_PADDING_TOP +
        heroExpandedHeaderHeight +
        HERO_EXPANDED_CONTENT_GAP +
        heroStatsRowHeight +
        HERO_EXPANDED_PADDING_BOTTOM
      : 0
  const expandedHeroHeight = Math.max(baseExpandedHeroHeight, measuredExpandedHeroHeight)
  const collapsedHeroHeight = 88
  const collapseDistance = expandedHeroHeight - collapsedHeroHeight
  const heroTopInset = insets.top + brandSpacing.xs

  const heroHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [expandedHeroHeight, collapsedHeroHeight],
    extrapolate: "clamp",
  })
  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.34, collapseDistance * 0.56],
    outputRange: [1, 0.22, 0],
    extrapolate: "clamp",
  })
  const expandedTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.56],
    outputRange: [0, -8],
    extrapolate: "clamp",
  })
  const compactOpacity = scrollY.interpolate({
    inputRange: [collapseDistance * 0.28, collapseDistance * 0.56, collapseDistance],
    outputRange: [0, 0.72, 1],
    extrapolate: "clamp",
  })
  const compactTranslateY = scrollY.interpolate({
    inputRange: [collapseDistance * 0.28, collapseDistance],
    outputRange: [10, 0],
    extrapolate: "clamp",
  })

  const stickyFilterOffset = heroTopInset + collapsedHeroHeight + brandSpacing.sm
  const heroShellHeight = Animated.add(heroHeight, heroTopInset)
  const topSpacerHeight = heroTopInset + expandedHeroHeight
  // The content starts under the expanded hero. With the filters bar, the bar
  // itself carries the last stickyFilterOffset as padding so that, once stuck,
  // it sits below the collapsed hero (sticky header index 0).
  const contentTopPadding = showFiltersPanel
    ? topSpacerHeight + PAGE_CONTENT_GAP - stickyFilterOffset
    : topSpacerHeight + PAGE_CONTENT_GAP
  const pageBottomPadding = tabBarHeight + brandSpacing.xl + 22

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }, [onRefresh])

  const refreshControl = useMemo(
    () =>
      onRefresh ? (
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={brandColors.forest}
        />
      ) : undefined,
    [handleRefresh, onRefresh, refreshing],
  )

  const handleScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        // The hero animates its height, which the native driver does not support.
        useNativeDriver: false,
      }),
    [scrollY],
  )

  // ── List header: the sticky filters bar (sticky index 0) ────────────────────

  const filtersHeader = useMemo(
    () =>
      showFiltersPanel ? (
        <View
          style={[
            styles.filtersStickyHost,
            useNativeSearchUI
              ? styles.filtersStickyHostNativeSearch
              : { paddingTop: stickyFilterOffset },
          ]}
        >
          <AppCard variant="panelElevated" padding={14} style={styles.filtersCard}>
            <View style={styles.filtersHeaderRow}>
              <View style={styles.filtersHeadingBlock}>
                <View style={styles.filtersCompactTitleRow}>
                  <Ionicons name="funnel-outline" size={14} color={brandColors.forest} />
                  <Text style={styles.filtersCompactTitle}>Filtres</Text>
                </View>
                <Text numberOfLines={1} style={styles.filtersCompactMeta}>
                  {filtersSummaryLabel}
                </Text>
              </View>

              <Pressable
                accessibilityLabel={
                  advancedFiltersOpen
                    ? "Masquer les filtres avancés"
                    : "Afficher les filtres avancés"
                }
                accessibilityRole="button"
                accessibilityState={{ expanded: advancedFiltersOpen }}
                style={styles.advancedToggle}
                onPress={() => setAdvancedFiltersOpen((current) => !current)}
              >
                <Ionicons
                  name={advancedFiltersOpen ? "close" : "funnel-outline"}
                  size={16}
                  color={brandColors.forest}
                />
                <Text style={styles.advancedToggleText}>
                  {advancedFiltersOpen
                    ? "Fermer"
                    : advancedFilterCount > 0
                      ? `${advancedFilterCount} actif${advancedFilterCount > 1 ? "s" : ""}`
                      : "Plus"}
                </Text>
              </Pressable>
            </View>

            {/* Inline search */}
            {showInlineSearch ? (
              <View style={styles.searchRow}>
                <View style={styles.searchField}>
                  <Ionicons name="search-outline" size={18} color={brandColors.textSecondary} />
                  <TextInput
                    value={surveyQuery}
                    onChangeText={setSurveyQuery}
                    placeholder="Rechercher par nom de site"
                    placeholderTextColor={brandColors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                    style={styles.searchInput}
                  />
                  {trimmedQuery.length > 0 ? (
                    <Pressable
                      accessibilityLabel="Effacer la recherche"
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setSurveyQuery("")}
                      style={styles.searchClearButton}
                    >
                      <Ionicons name="close-circle" size={18} color={brandColors.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* P2-COMPACT-02: Status chips only when active filter or advanced panel open */}
            {statusFilter !== "all" || advancedFiltersOpen ? (
              <FilterSection
                label="Statut"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            ) : null}

            {advancedFiltersOpen ? (
              <View style={styles.advancedPanel}>
                <View style={styles.dateInputsRow}>
                  <AppField
                    label="Du"
                    value={surveyFromDate}
                    onChangeText={setSurveyFromDate}
                    placeholder="AAAA-MM-JJ"
                    autoCapitalize="none"
                    autoCorrect={false}
                    containerStyle={styles.dateInputBlock}
                    labelStyle={styles.filterSectionLabel}
                    inputStyle={styles.compactInput}
                  />
                  <AppField
                    label="Au"
                    value={surveyToDate}
                    onChangeText={setSurveyToDate}
                    placeholder="AAAA-MM-JJ"
                    autoCapitalize="none"
                    autoCorrect={false}
                    containerStyle={styles.dateInputBlock}
                    labelStyle={styles.filterSectionLabel}
                    inputStyle={styles.compactInput}
                  />
                </View>

                <FilterSection
                  label="Synchronisation"
                  options={SYNC_OPTIONS}
                  value={syncFilter}
                  onChange={setSyncFilter}
                />
                <FilterSection
                  label="Bloqués"
                  options={BLOCKED_OPTIONS}
                  value={blockedFilter}
                  onChange={setBlockedFilter}
                />
                <FilterSection
                  label="Pièces jointes"
                  options={ATTACHMENT_OPTIONS}
                  value={attachmentFilter}
                  onChange={setAttachmentFilter}
                />
                <FilterSection
                  label="Tri"
                  options={SORT_OPTIONS}
                  value={sortMode}
                  onChange={setSortMode}
                />

                <AppButton
                  label="Réinitialiser les filtres"
                  variant="secondary"
                  size="sm"
                  onPress={resetFilters}
                  style={styles.resetButton}
                />
              </View>
            ) : null}
          </AppCard>
        </View>
      ) : null,
    [
      advancedFilterCount,
      advancedFiltersOpen,
      attachmentFilter,
      blockedFilter,
      filtersSummaryLabel,
      resetFilters,
      setAttachmentFilter,
      setBlockedFilter,
      setSortMode,
      setStatusFilter,
      setSurveyFromDate,
      setSurveyQuery,
      setSurveyToDate,
      setSyncFilter,
      showFiltersPanel,
      showInlineSearch,
      sortMode,
      statusFilter,
      stickyFilterOffset,
      surveyFromDate,
      surveyQuery,
      surveyToDate,
      syncFilter,
      trimmedQuery,
      useNativeSearchUI,
    ],
  )

  // ── Leading list items: create card, "À faire" card, section header ────────
  // They scroll under the sticky filters bar, so they are list items rather
  // than part of the header.

  const createCardElement = useMemo(
    () =>
      showHero ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={createSurveyCardCopy.accessibilityLabel}
          onPress={() => {
            triggerHaptic()
            onOpenCreateSurvey()
          }}
          style={({ pressed }) => [pressed && styles.createSurveyCardPressed]}
        >
          <AppCard variant="panelElevated" padding={16} style={styles.createSurveyCard}>
            <View pointerEvents="none" style={styles.createSurveyAccentOrb} />
            <View pointerEvents="none" style={styles.createSurveyAccentRail} />

            <View style={styles.createSurveyHeader}>
              <View style={styles.createSurveyBadge}>
                <Ionicons name="leaf-outline" size={14} color={brandColors.forest} />
                <Text style={styles.createSurveyBadgeText}>{createSurveyCardCopy.badge}</Text>
              </View>

              <View style={styles.createSurveyActionPill}>
                <Text style={styles.createSurveyActionText}>
                  {createSurveyCardCopy.actionLabel}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={brandColors.white} />
              </View>
            </View>

            <Text style={styles.createSurveyTitle}>{createSurveyCardCopy.title}</Text>
            <Text style={styles.createSurveyBody}>{createSurveyCardCopy.body}</Text>
          </AppCard>
        </Pressable>
      ) : null,
    [createSurveyCardCopy, onOpenCreateSurvey, showHero],
  )

  const todoCardElement = useMemo(
    () =>
      showHero && (attentionSurveys.length > 0 || continueDraftSurvey) ? (
        <AppCard variant="surface" padding={14} style={styles.todoCard}>
          <AppSectionHeader
            title="À faire"
            subtitle={
              attentionSurveys.length > 0 && continueDraftSurvey
                ? `${attentionSurveys.length} problème${attentionSurveys.length > 1 ? "s" : ""} · brouillon en cours`
                : attentionSurveys.length > 0
                  ? `${attentionSurveys.length} relevé${attentionSurveys.length > 1 ? "s" : ""} à examiner`
                  : "Brouillon en cours"
            }
            titleStyle={styles.homeSectionTitle}
            subtitleStyle={styles.homeSectionSubtitle}
          />

          {/* Attention rows — max 2 visible */}
          {visibleAttentionSurveys.map((survey) => {
            const uiStatus = resolveSurveyUiStatus(survey)
            const { bg, iconName, iconColor } = resolveAttentionStyle(uiStatus)

            return (
              <Pressable
                key={survey.id}
                accessibilityRole="button"
                accessibilityLabel={`${survey.site_name}, ${formatSurveyUiStatusLabel(uiStatus)}`}
                onPress={() => {
                  triggerHaptic()
                  onOpenSurvey(survey.id)
                }}
                style={({ pressed }) => [
                  styles.attentionRow,
                  { backgroundColor: bg },
                  pressed && styles.rowPressed,
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={18}
                  color={iconColor}
                  style={styles.attentionRowIcon}
                />
                <View style={styles.attentionRowCopy}>
                  <Text numberOfLines={1} style={styles.attentionRowTitle}>
                    {survey.site_name}
                  </Text>
                  <Text numberOfLines={1} style={styles.attentionRowMeta}>
                    {formatSyncErrorForUser(survey.last_sync_error) ??
                      `Mis à jour ${formatShortDateTime(survey.updated_at)}`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={brandColors.textSecondary} />
              </Pressable>
            )
          })}

          {/* "Voir N autres" if more than 2 */}
          {hiddenAttentionCount > 0 ? (
            <Text style={styles.seeMoreText}>
              +{hiddenAttentionCount} autre{hiddenAttentionCount > 1 ? "s" : ""} relevé
              {hiddenAttentionCount > 1 ? "s" : ""} à examiner
            </Text>
          ) : null}

          {/* Divider between attention rows and draft */}
          {attentionSurveys.length > 0 && continueDraftSurvey ? (
            <View style={styles.todoDivider} />
          ) : null}

          {/* P2-PERSON-03: Draft row — sage-tinted, compact with progress bar */}
          {continueDraftSurvey ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Continuer le brouillon : ${continueDraftSurvey.site_name}`}
              onPress={() => {
                triggerHaptic()
                onOpenSurvey(continueDraftSurvey.id)
              }}
              style={({ pressed }) => [styles.draftRow, pressed && styles.rowPressed]}
            >
              <View style={styles.draftIconWrap}>
                <Ionicons name="document-text-outline" size={16} color={brandColors.forest} />
              </View>
              <View style={styles.draftContent}>
                <Text numberOfLines={1} style={styles.draftTitle}>
                  {continueDraftSurvey.site_name}
                </Text>
                {/* P2-UX-01: Visual progress bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max(4, Math.min(100, continueDraftSurvey.completion_rate))}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.draftMeta}>
                  {continueDraftSurvey.completion_rate}% complété
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={brandColors.textSecondary} />
            </Pressable>
          ) : null}
        </AppCard>
      ) : null,
    [
      attentionSurveys.length,
      continueDraftSurvey,
      hiddenAttentionCount,
      onOpenSurvey,
      showHero,
      visibleAttentionSurveys,
    ],
  )

  const sectionHeaderElement = useMemo(
    () =>
      mainListSurveys.length > 0 || (useNativeSearchUI && surveys.length > 0) ? (
        <AppSectionHeader
          title={useNativeSearchUI ? "Résultats" : "Mes relevés"}
          subtitle={
            showHero && mainListSurveys.length < visibleSurveys.length
              ? `${mainListSurveys.length} autre${mainListSurveys.length > 1 ? "s" : ""} relevé${mainListSurveys.length > 1 ? "s" : ""}`
              : visibleSurveySummary
          }
          titleStyle={styles.homeSectionTitle}
          subtitleStyle={styles.homeSectionSubtitle}
          style={styles.listSectionHeader}
        />
      ) : null,
    [
      mainListSurveys.length,
      showHero,
      surveys.length,
      useNativeSearchUI,
      visibleSurveySummary,
      visibleSurveys.length,
    ],
  )

  const leadingItems = useMemo(() => {
    const items: LeadingListItem[] = []
    if (createCardElement)
      items.push({ kind: "leading", key: "create", element: createCardElement })
    if (todoCardElement) items.push({ kind: "leading", key: "todo", element: todoCardElement })
    if (sectionHeaderElement)
      items.push({ kind: "leading", key: "section", element: sectionHeaderElement })
    return items
  }, [createCardElement, sectionHeaderElement, todoCardElement])

  const listData = useMemo<SurveyListItem[]>(
    () => [...leadingItems, ...mainListSurveys],
    [leadingItems, mainListSurveys],
  )

  // ── Rows ────────────────────────────────────────────────────────────────────

  // One preview value per survey, derived once per attachments change (D-03).
  const previewById = useMemo(() => {
    const byId: Record<string, SurveyRowPreview> = {}
    for (const [surveyId, attachments] of Object.entries(attachmentsBySurvey)) {
      const firstPhoto = attachments.find(isPhotoAttachment)
      if (firstPhoto) {
        byId[surveyId] = { ...resolveAttachmentPreview(firstPhoto), attachmentId: firstPhoto.id }
      }
    }
    return byId
  }, [attachmentsBySurvey])

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SurveyListItem>) =>
      isLeadingListItem(item) ? (
        item.element
      ) : (
        <SurveyRow
          survey={item}
          preview={previewById[item.id] ?? null}
          selected={selectedSurveyId === item.id}
          onOpen={onOpenSurvey}
          onDelete={onDeleteSurvey}
        />
      ),
    [onDeleteSurvey, onOpenSurvey, previewById, selectedSurveyId],
  )

  // ── Footer: empty states and bottom spacing ─────────────────────────────────

  const listFooter = useMemo(
    () => (
      <>
        {/* ── Empty states ──────────────────────────────────────────────────── */}
        {/* P2-PERSON-04: marten illustration + warm copy */}
        {surveys.length === 0 ? (
          <AppCard variant="panelElevated" padding={24} style={styles.emptyState}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require("../../assets/auth/marten.png")}
              style={styles.emptyStateMarten}
              resizeMode="contain"
            />
            <Text style={styles.emptyStateTitle}>La nature vous attend</Text>
            <Text style={styles.emptyStateBody}>
              Commencez votre premier relevé IBP et contribuez à la connaissance de la biodiversité.
            </Text>
          </AppCard>
        ) : null}

        {surveys.length > 0 && visibleSurveys.length === 0 ? (
          <AppCard variant="panelElevated" padding={22} style={styles.emptyState}>
            <Ionicons name="funnel-outline" size={28} color={brandColors.forest} />
            <Text style={styles.emptyStateTitle}>Aucun résultat</Text>
            <Text style={styles.emptyStateBody}>
              Élargissez les critères ou réinitialisez les filtres pour voir plus de relevés.
            </Text>
            <AppButton
              label="Réinitialiser les filtres"
              variant="secondary"
              size="sm"
              onPress={resetFilters}
              style={styles.resetButton}
            />
          </AppCard>
        ) : null}

        {showHero ? <View style={{ height: brandSpacing.xl }} /> : null}
      </>
    ),
    [resetFilters, showHero, surveys.length, visibleSurveys.length],
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Hero — box-none so stat tiles are tappable, scroll passes through */}
      {showHero ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.heroShell, { height: heroShellHeight, paddingTop: heroTopInset }]}
        >
          <View pointerEvents="box-none" style={styles.heroCard}>
            {/* Decorative brand mark */}
            <View pointerEvents="none" style={styles.heroLogoWrap}>
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require("../../assets/logo-app.png")}
                style={styles.heroLogoOrnament}
                resizeMode="contain"
              />
            </View>

            {/* Expanded layer */}
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.heroExpandedLayer,
                { opacity: expandedOpacity, transform: [{ translateY: expandedTranslateY }] },
              ]}
            >
              {/* Title area — non-interactive */}
              <View
                pointerEvents="none"
                style={styles.heroExpandedHeader}
                onLayout={(event) => {
                  setHeroExpandedHeaderHeight(Math.ceil(event.nativeEvent.layout.height))
                }}
              >
                {/* P2-PERSON-02: Contextual eyebrow */}
                <Text style={styles.heroEyebrow}>{heroEyebrow}</Text>
                <Text style={styles.heroTitleExpanded}>Votre carnet de terrain</Text>
                {/* P2-GLANCE-03: Dynamic body */}
                <Text style={styles.heroBody}>{heroBodyText}</Text>
              </View>

              {/* P1-GLANCE-01: Single horizontal row of 4 stat tiles */}
              <View
                pointerEvents="box-none"
                style={styles.heroStatsRow}
                onLayout={(event) => {
                  setHeroStatsRowHeight(Math.ceil(event.nativeEvent.layout.height))
                }}
              >
                {heroStats.map((stat) => (
                  <SurveyStatTile key={stat.label} {...stat} />
                ))}
              </View>
            </Animated.View>

            {/* Compact layer */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.heroCompactLayer,
                { opacity: compactOpacity, transform: [{ translateY: compactTranslateY }] },
              ]}
            >
              <Text numberOfLines={1} style={styles.heroTitleCompact}>
                Votre carnet de terrain
              </Text>
              <Text numberOfLines={1} style={styles.heroCompactSummary}>
                {compactSummary}
              </Text>
            </Animated.View>

            {/* P1-PERSON-01: BrandBump at the bottom of the hero card */}
            <View pointerEvents="none">
              <BrandBump
                width={heroCardWidth}
                height={22}
                color={brandColors.moss}
                opacity={0.16}
              />
            </View>
          </View>
        </Animated.View>
      ) : null}

      <Animated.FlatList
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={filtersHeader}
        ListFooterComponent={listFooter}
        initialNumToRender={leadingItems.length + INITIAL_ROWS}
        maxToRenderPerBatch={INITIAL_ROWS}
        windowSize={7}
        removeClippedSubviews
        style={styles.pageScroll}
        contentContainerStyle={[
          styles.pageContent,
          { paddingBottom: pageBottomPadding },
          useNativeSearchUI ? styles.pageContentNativeSearch : null,
          showHero ? { paddingTop: contentTopPadding } : null,
        ]}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{
          top: showHero ? heroTopInset + collapsedHeroHeight : 0,
          bottom: tabBarHeight,
        }}
        stickyHeaderIndices={filtersHeader ? STICKY_HEADER_INDICES : undefined}
        contentInsetAdjustmentBehavior={useNativeSearchUI ? "automatic" : "never"}
        onScroll={handleScroll}
        refreshControl={refreshControl}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.canvas,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroShell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: 16,
  },
  heroCard: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
    borderRadius: brandRadius.hero,
    backgroundColor: brandColors.forest,
    ...brandShadow.card,
  },
  // Decorative round logo, lightly faded into the hero background.
  heroLogoWrap: {
    position: "absolute",
    top: -12,
    right: -14,
  },
  heroExpandedLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-start",
    paddingTop: HERO_EXPANDED_PADDING_TOP,
    paddingBottom: HERO_EXPANDED_PADDING_BOTTOM,
    paddingHorizontal: 20,
    gap: HERO_EXPANDED_CONTENT_GAP,
  },
  heroExpandedHeader: {
    gap: 6,
    // P3-LAYOUT-01: uses named constant so fern/text exclusion stays in sync
    paddingRight: HERO_ORNAMENT_EXCLUSION,
  },
  heroEyebrow: {
    ...brandTypography.heroEyebrow,
    color: brandSemanticColors.heroMetaOnDark,
  },
  heroTitleExpanded: {
    ...brandTypography.heroTitle,
    color: brandColors.white,
  },
  heroBody: {
    ...brandTypography.heroBody,
    color: brandSemanticColors.heroBodyOnDark,
  },
  // P1-GLANCE-01: single horizontal row (replaces 2×2 grid)
  heroStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  // P3-PERSON-05 + P1-A11Y-01: custom tile (not AppStatusChip) for full style control
  statTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: brandRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statTileText: {
    ...brandTypography.meta,
    fontSize: 12,
    color: brandColors.white,
  },
  statTilePressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  heroCompactLayer: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingRight: 96,
    gap: 6,
  },
  heroLogoOrnament: {
    width: 136,
    height: 136,
    opacity: 0.16,
  },
  heroTitleCompact: {
    ...brandTypography.heroTitle,
    fontSize: 24,
    lineHeight: 28,
    color: brandColors.white,
  },
  heroCompactSummary: {
    ...brandTypography.meta,
    fontSize: 13,
    lineHeight: 18,
    color: brandSemanticColors.heroMetaOnDark,
  },

  // ── Scroll ────────────────────────────────────────────────────────────────
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    gap: PAGE_CONTENT_GAP, // P3-COMPACT-03: 14 → 10
  },
  pageContentNativeSearch: {
    paddingTop: 8,
  },

  // ── Filters ───────────────────────────────────────────────────────────────
  filtersStickyHost: {
    backgroundColor: brandColors.canvas,
    zIndex: 1,
    paddingBottom: 10,
  },
  filtersStickyHostNativeSearch: {
    paddingTop: 4,
  },
  filtersCard: {
    gap: 10,
  },
  filtersHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  filtersHeadingBlock: {
    flex: 1,
    gap: 4,
  },
  filtersCompactTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filtersCompactTitle: {
    ...brandTypography.meta,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: brandColors.forest,
    textTransform: "uppercase",
  },
  filtersCompactMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  advancedToggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  advancedToggleText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  searchRow: {
    paddingBottom: 2,
  },
  searchField: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: brandRadius.field,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.inputFill,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 0,
    color: brandColors.textPrimary,
    ...brandTypography.input,
    fontSize: 15,
    lineHeight: 18,
  },
  searchClearButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  filterSection: {
    gap: 6,
  },
  filterSectionLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
    color: brandColors.forest,
    textTransform: "uppercase",
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingRight: 8,
  },
  advancedPanel: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: brandColors.divider,
    paddingTop: 10,
  },
  dateInputsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateInputBlock: {
    flex: 1,
    gap: 4,
  },
  compactInput: {
    minHeight: 40,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
  resetButton: {
    alignSelf: "flex-start",
  },

  // ── Create survey CTA ─────────────────────────────────────────────────────
  createSurveyCard: {
    position: "relative",
    overflow: "hidden",
    borderColor: "rgba(51, 78, 43, 0.18)",
    backgroundColor: brandColors.panel,
    gap: 10,
  },
  createSurveyAccentOrb: {
    position: "absolute",
    top: -20,
    right: -8,
    width: 112,
    height: 112,
    borderRadius: 999,
    backgroundColor: "rgba(137,163,58,0.12)",
  },
  createSurveyAccentRail: {
    position: "absolute",
    top: 16,
    bottom: 16,
    left: 0,
    width: 5,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    backgroundColor: brandColors.moss,
  },
  createSurveyHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  createSurveyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: brandRadius.pill,
    backgroundColor: "rgba(176, 199, 142, 0.24)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  createSurveyBadgeText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  createSurveyActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.forest,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  createSurveyActionText: {
    ...brandTypography.meta,
    color: brandColors.white,
  },
  createSurveyTitle: {
    ...brandTypography.input,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: "900",
    color: brandColors.forest,
  },
  createSurveyBody: {
    ...brandTypography.sectionBody,
    maxWidth: "88%",
    color: brandColors.textSecondary,
  },
  createSurveyCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },

  // ── "À faire" merged card (P1-GLANCE-02) ─────────────────────────────────
  todoCard: {
    gap: 10,
  },
  homeSectionTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 24,
    lineHeight: 28,
  },
  homeSectionSubtitle: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  // Attention rows — P3-TOUCH-01: minHeight 44 for touch target
  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44, // P3-TOUCH-01
    borderRadius: brandRadius.field,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attentionRowIcon: {
    flexShrink: 0,
  },
  attentionRowCopy: {
    flex: 1,
    gap: 3,
  },
  attentionRowTitle: {
    ...brandTypography.input,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: brandColors.textPrimary,
  },
  attentionRowMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  seeMoreText: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
    paddingLeft: 2,
  },
  todoDivider: {
    height: 1,
    backgroundColor: brandColors.divider,
  },
  // P2-PERSON-03: draft row with sage tint
  draftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    borderRadius: brandRadius.field,
    backgroundColor: brandColors.successSoft, // sage-adjacent warm green
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  draftIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    flexShrink: 0,
  },
  draftContent: {
    flex: 1,
    gap: 4,
  },
  draftTitle: {
    ...brandTypography.input,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: brandColors.textPrimary,
  },
  // P2-UX-01: progress bar
  progressTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: brandComponentTokens.surveyList.progressTrack,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: brandColors.moss,
  },
  draftMeta: {
    ...brandTypography.meta,
    fontSize: 11,
    color: brandColors.textSecondary,
  },

  // ── List section header ───────────────────────────────────────────────────
  listSectionHeader: {
    paddingHorizontal: 2,
  },

  // ── Shared interaction ────────────────────────────────────────────────────
  rowPressed: {
    opacity: 0.88,
  },

  // ── Empty states ──────────────────────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    gap: 10,
  },
  // P2-PERSON-04: marten illustration
  emptyStateMarten: {
    width: 110,
    height: 110,
    marginBottom: 4,
  },
  emptyStateTitle: {
    ...brandTypography.input,
    color: brandColors.forest,
  },
  emptyStateBody: {
    ...brandTypography.sectionBody,
    textAlign: "center",
    color: brandColors.textSecondary,
  },
})
