import { useMemo, useRef, useState } from "react"
import {
  Animated,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
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
import { formatDateTime } from "../app/formatters"
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
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppChoiceChip } from "../ui/AppChoiceChip"
import { AppField } from "../ui/AppField"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { AppStatusChip } from "../ui/AppStatusChip"

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
  onOpenCreateSurvey: () => void
  onOpenSurvey: (surveyId: string) => void
}

type SurveyRowTone = "neutral" | "success" | "warning" | "danger"

type SurveyBadgeProps = {
  label: string
  tone?: SurveyRowTone
}

type SurveyStatTileProps = {
  label: string
  value: string
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

function resolveSurveyRowTone(uiStatus: ReturnType<typeof resolveSurveyUiStatus>): SurveyRowTone {
  if (uiStatus === "sync_error" || uiStatus === "sync_blocked" || uiStatus === "expired")
    return "danger"
  if (uiStatus === "submitted") return "success"
  if (uiStatus === "sync_pending") return "warning"
  return "neutral"
}

function resolveAttentionStyle(uiStatus: ReturnType<typeof resolveSurveyUiStatus>): {
  bg: string
  iconName: keyof typeof Ionicons.glyphMap
  iconColor: string
} {
  if (uiStatus === "sync_blocked" || uiStatus === "sync_error") {
    return { bg: brandColors.errorSoft, iconName: "alert-circle", iconColor: brandColors.terracotta }
  }
  if (uiStatus === "expired") {
    return { bg: brandColors.warningSoft, iconName: "time", iconColor: brandColors.ochre }
  }
  return { bg: brandColors.panel, iconName: "information-circle", iconColor: brandColors.textSecondary }
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

function triggerHaptic() {
  if (Platform.OS === "ios") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SurveyStatTile({ label, value, onPress, accessibilityLabel }: SurveyStatTileProps) {
  return (
    <Pressable
      onPress={() => { triggerHaptic(); onPress() }}
      style={({ pressed }) => [pressed && styles.statTilePressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <AppStatusChip
        label={`${value} ${label}`}
        tone="onDark"
        style={styles.heroStatTile}
      />
    </Pressable>
  )
}

function SurveyBadge({ label, tone = "neutral" }: SurveyBadgeProps) {
  return (
    <AppStatusChip
      label={label}
      tone={tone}
      labelStyle={tone === "danger" ? styles.badgeTextDanger : undefined}
    />
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
  onOpenCreateSurvey,
  onOpenSurvey,
}: SurveyListScreenProps) {
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const scrollY = useRef(new Animated.Value(0)).current
  const { height: viewportHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useAppBottomTabBarHeight(Platform.select({ ios: 84, default: 68 }) ?? 68)
  const trimmedQuery = surveyQuery.trim()
  const showHero = !useNativeSearchUI
  const showFiltersPanel = useNativeSearchUI || showInlineSearch

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

  // ── Hero stats — 4 tiles always (P2-07) ────────────────────────────────────

  const heroStats = useMemo(
    () => [
      {
        label: "relevés",
        value: String(surveyStats.total),
        onPress: resetFilters,
        accessibilityLabel: `${surveyStats.total} relevés au total — appuyer pour tout afficher`,
      },
      {
        label: "brouillons",
        value: String(surveyStats.draft),
        onPress: () => setStatusFilter("draft"),
        accessibilityLabel: `${surveyStats.draft} brouillons — appuyer pour filtrer`,
      },
      {
        label: "en attente",
        value: String(surveyStats.pending),
        onPress: () => setSyncFilter("pending"),
        accessibilityLabel: `${surveyStats.pending} en attente de sync — appuyer pour filtrer`,
      },
      surveyStats.blocked > 0
        ? {
            label: "bloqués",
            value: String(surveyStats.blocked),
            onPress: () => setBlockedFilter("blocked"),
            accessibilityLabel: `${surveyStats.blocked} relevés bloqués — appuyer pour filtrer`,
          }
        : {
            label: "soumis",
            value: String(surveyStats.submitted),
            onPress: () => setStatusFilter("submitted"),
            accessibilityLabel: `${surveyStats.submitted} relevés soumis — appuyer pour filtrer`,
          },
    ],
    [
      surveyStats,
      resetFilters,
      setStatusFilter,
      setSyncFilter,
      setBlockedFilter,
    ],
  )

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
      const priorityDelta = resolveAttentionPriority(leftStatus) - resolveAttentionPriority(rightStatus)
      if (priorityDelta !== 0) return priorityDelta
      return parseSurveyDate(right.updated_at) - parseSurveyDate(left.updated_at)
    })

    return items.slice(0, 3)
  }, [continueDraftSurvey?.id, surveys])

  // ── Main list — deduplicated (P1-04) ────────────────────────────────────────

  const excludedIds = useMemo(() => {
    const ids = new Set<string>()
    if (continueDraftSurvey) ids.add(continueDraftSurvey.id)
    attentionSurveys.forEach((s) => ids.add(s.id))
    return ids
  }, [continueDraftSurvey, attentionSurveys])

  const mainListSurveys = useMemo(
    () =>
      showHero
        ? visibleSurveys.filter((s) => !excludedIds.has(s.id))
        : visibleSurveys,
    [showHero, visibleSurveys, excludedIds],
  )

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

  // ── Compact summary — reflects filters (P3-02) ─────────────────────────────

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

  // ── Hero animation ──────────────────────────────────────────────────────────

  const expandedHeroHeight = Math.max(220, Math.min(272, Math.round(viewportHeight * 0.28)))
  const collapsedHeroHeight = 92
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
    outputRange: [0, -10],
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
  const topSpacerHeight = showHero ? heroTopInset + expandedHeroHeight : 0

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    if (!onRefresh) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Hero — P1-01: box-none so stat tiles are tappable, scroll passes through empty areas */}
      {showHero ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.heroShell,
            { height: heroShellHeight, paddingTop: heroTopInset },
          ]}
        >
          <View pointerEvents="box-none" style={styles.heroCard}>
            {/* Decorative orb — not interactive */}
            <View pointerEvents="none" style={styles.heroAccentOrb} />

            {/* Expanded layer */}
            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.heroExpandedLayer,
                { opacity: expandedOpacity, transform: [{ translateY: expandedTranslateY }] },
              ]}
            >
              {/* Title area — non-interactive, lets scroll pass through */}
              <View pointerEvents="none" style={styles.heroExpandedHeader}>
                <Text style={styles.heroEyebrow}>ACCUEIL</Text>
                <Text style={styles.heroTitleExpanded}>Votre carnet de terrain</Text>
                <Text style={styles.heroBody}>
                  Retrouvez vos brouillons, résolvez les problèmes de sync, reprenez vos relevés.
                </Text>
              </View>

              {/* Stat tiles — interactive (P1-01, P2-07) */}
              <View pointerEvents="box-none" style={styles.heroStatsGrid}>
                {heroStats.map((stat) => (
                  <SurveyStatTile key={stat.label} {...stat} />
                ))}
              </View>
            </Animated.View>

            {/* Compact layer — non-interactive */}
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
          </View>
        </Animated.View>
      ) : null}

      <Animated.ScrollView
        style={styles.pageScroll}
        contentContainerStyle={[
          styles.pageContent,
          useNativeSearchUI ? styles.pageContentNativeSearch : null,
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        stickyHeaderIndices={showFiltersPanel ? (useNativeSearchUI ? [0] : [1]) : undefined}
        contentInsetAdjustmentBehavior={useNativeSearchUI ? "automatic" : "never"}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={brandColors.forest}
            />
          ) : undefined
        }
      >
        {showHero ? <View style={{ height: topSpacerHeight }} /> : null}

        {/* Filters sticky bar ─────────────────────────────────────────────── */}
        {showFiltersPanel ? (
          <View
            style={[
              styles.filtersStickyHost,
              useNativeSearchUI
                ? styles.filtersStickyHostNativeSearch
                : { paddingTop: stickyFilterOffset, marginTop: -stickyFilterOffset },
            ]}
          >
            <AppCard variant="panelElevated" padding={14} style={styles.filtersCard}>
              <View style={styles.filtersHeaderRow}>
                {/* P2-05: unified "Filtres" label in both modes */}
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
                  accessibilityLabel={advancedFiltersOpen ? "Masquer les filtres avancés" : "Afficher les filtres avancés"}
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

              {/* Inline search (JS-nav fallback) */}
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

              <FilterSection
                label="Statut"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
              />

              {advancedFiltersOpen ? (
                <View style={styles.advancedPanel}>
                  {/* P1-03 note: date fields kept as text until @react-native-community/datetimepicker is added */}
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
        ) : null}

        {/* ── P2-01: Needs attention FIRST ─────────────────────────────────── */}
        {showHero && attentionSurveys.length > 0 ? (
          <AppCard variant="surface" padding={16} style={styles.featureCard}>
            <AppSectionHeader
              title="Nécessite attention"
              subtitle={`${attentionSurveys.length} relevé${attentionSurveys.length > 1 ? "s" : ""} à examiner`}
              titleStyle={styles.homeSectionTitle}
              subtitleStyle={styles.homeSectionSubtitle}
            />
            <View style={styles.attentionList}>
              {attentionSurveys.map((survey) => {
                const uiStatus = resolveSurveyUiStatus(survey)
                const rowTone = resolveSurveyRowTone(uiStatus)
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
                    {/* P2-08: severity icon */}
                    <Ionicons name={iconName} size={18} color={iconColor} style={styles.attentionRowIcon} />
                    <View style={styles.attentionRowCopy}>
                      <Text numberOfLines={1} style={styles.attentionRowTitle}>
                        {survey.site_name}
                      </Text>
                      <Text numberOfLines={2} style={styles.attentionRowMeta}>
                        {survey.last_sync_error?.trim()
                          ? survey.last_sync_error
                          : `Mis à jour ${formatDateTime(survey.updated_at)}`}
                      </Text>
                    </View>
                    <View style={styles.attentionRowTrailing}>
                      <SurveyBadge label={formatSurveyUiStatusLabel(uiStatus)} tone={rowTone} />
                      <Ionicons name="chevron-forward" size={16} color={brandColors.textSecondary} />
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </AppCard>
        ) : null}

        {/* ── P2-01: Continue draft SECOND ─────────────────────────────────── */}
        {showHero && continueDraftSurvey ? (
          <AppCard variant="surface" padding={16} style={styles.featureCard}>
            <AppSectionHeader
              title="Continuer le brouillon"
              subtitle={`Mis à jour ${formatDateTime(continueDraftSurvey.updated_at)}`}
              titleStyle={styles.homeSectionTitle}
              subtitleStyle={styles.homeSectionSubtitle}
              trailing={
                <SurveyBadge
                  label={formatSurveyUiStatusLabel(resolveSurveyUiStatus(continueDraftSurvey))}
                  tone={resolveSurveyRowTone(resolveSurveyUiStatus(continueDraftSurvey))}
                />
              }
            />
            <Text style={styles.featureTitle}>{continueDraftSurvey.site_name}</Text>
            <Text style={styles.featureBody}>
              {continueDraftSurvey.completion_rate}% complété. Reprenez là où vous vous êtes arrêté.
            </Text>
            <View style={styles.featureActions}>
              <AppButton
                label="Continuer"
                size="sm"
                leadingIcon="arrow-forward-outline"
                onPress={() => {
                  triggerHaptic()
                  onOpenSurvey(continueDraftSurvey.id)
                }}
              />
            </View>
          </AppCard>
        ) : null}

        {/* ── P2-01: Create card THIRD — P3-08: icon add-outline ───────────── */}
        {showHero ? (
          <AppCard variant="surface" padding={16} style={styles.createCard}>
            <View style={styles.createHeader}>
              <View style={styles.createIconWrap}>
                <Ionicons name="add-outline" size={20} color={brandColors.forest} />
              </View>
              <View style={styles.createCopy}>
                <Text style={styles.createTitle}>Nouveau relevé</Text>
                <Text style={styles.createBody}>
                  Démarrez un nouveau carnet de terrain et capturez vos observations.
                </Text>
              </View>
            </View>
            <AppButton
              label="Démarrer un relevé"
              size="md"
              leadingIcon="add-outline"
              onPress={() => {
                triggerHaptic()
                onOpenCreateSurvey()
              }}
              style={styles.createButton}
            />
          </AppCard>
        ) : null}

        {/* ── Section header for main list ──────────────────────────────────── */}
        {mainListSurveys.length > 0 || (useNativeSearchUI && surveys.length > 0) ? (
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
        ) : null}

        {/* ── Survey cards list ─────────────────────────────────────────────── */}
        {mainListSurveys.map((survey) => {
          const attachments = attachmentsBySurvey[survey.id] ?? []
          const firstAttachmentWithPreview = attachments.find((a) => Boolean(a.local_uri?.trim()))
          const uiStatus = resolveSurveyUiStatus(survey)
          const uiStatusLabel = formatSurveyUiStatusLabel(uiStatus)
          const supportText = survey.last_sync_error?.trim() ? survey.last_sync_error : null
          const rowTone = resolveSurveyRowTone(uiStatus)
          const isSelected = selectedSurveyId === survey.id

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${survey.site_name}, ${uiStatusLabel}, mis à jour ${formatDateTime(survey.updated_at)}`}
              key={survey.id}
              style={({ pressed }) => [
                styles.surveyCard,
                isSelected ? styles.surveyCardSelected : null,
                pressed && styles.rowPressed,
              ]}
              onPress={() => {
                triggerHaptic()
                onOpenSurvey(survey.id)
              }}
            >
              {/* Accent bar */}
              <View
                style={[
                  styles.surveyCardAccent,
                  rowTone === "success"
                    ? styles.surveyCardAccentSuccess
                    : rowTone === "warning"
                      ? styles.surveyCardAccentWarning
                      : rowTone === "danger"
                        ? styles.surveyCardAccentDanger
                        : null,
                ]}
              />

              {/* Thumbnail — P3-04: 72×96 */}
              <View style={styles.surveyCardMedia}>
                {firstAttachmentWithPreview?.local_uri ? (
                  <Image
                    source={{ uri: firstAttachmentWithPreview.local_uri }}
                    style={styles.surveyCardPreview}
                  />
                ) : (
                  <View style={styles.surveyCardPreviewPlaceholder}>
                    <Ionicons name="image-outline" size={22} color={brandColors.textSecondary} />
                  </View>
                )}
              </View>

              {/* Content */}
              <View style={styles.surveyCardContent}>
                <View style={styles.surveyCardHeader}>
                  <Text numberOfLines={2} style={styles.surveyCardTitle}>
                    {survey.site_name}
                  </Text>
                  {isSelected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={brandColors.forest}
                      style={styles.surveyCardSelectedIcon}
                    />
                  ) : null}
                </View>

                {/* Status badge */}
                <View style={styles.surveyCardStatusRow}>
                  <SurveyBadge label={uiStatusLabel} tone={rowTone} />
                </View>

                {/* P2-03: simplified meta — date only */}
                <Text numberOfLines={1} style={styles.surveyCardMeta}>
                  Mis à jour {formatDateTime(survey.updated_at)}
                </Text>

                {/* Error message */}
                {supportText ? (
                  <Text numberOfLines={2} style={styles.surveyCardSupport}>
                    {supportText}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )
        })}

        {/* ── Empty states (P3-01: with CTA) ───────────────────────────────── */}
        {surveys.length === 0 ? (
          <AppCard variant="panelElevated" padding={22} style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={28} color={brandColors.forest} />
            <Text style={styles.emptyStateTitle}>Aucun relevé pour l'instant</Text>
            <Text style={styles.emptyStateBody}>
              Démarrez votre premier relevé IBP pour construire votre carnet de terrain.
            </Text>
            <AppButton
              label="Créer mon premier relevé"
              leadingIcon="add-outline"
              size="sm"
              onPress={() => {
                triggerHaptic()
                onOpenCreateSurvey()
              }}
            />
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

        {/* Spacer so content isn't hidden behind FAB */}
        {showHero ? <View style={{ height: brandSpacing.xl }} /> : null}
      </Animated.ScrollView>

      {/* ── FAB — create survey (P2-06), only in home mode ───────────────────── */}
      {showHero ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Créer un relevé"
          onPress={() => {
            triggerHaptic()
            onOpenCreateSurvey()
          }}
          style={({ pressed }) => [
            styles.fab,
            { bottom: tabBarHeight + insets.bottom + 8 },
            pressed && styles.fabPressed,
          ]}
        >
          <Ionicons name="add" size={28} color={brandColors.white} />
        </Pressable>
      ) : null}
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
  heroAccentOrb: {
    position: "absolute",
    top: -18,
    right: -26,
    width: 132,
    height: 132,
    borderRadius: 999,
    backgroundColor: brandSemanticColors.heroOrbOnDark,
  },
  heroExpandedLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 20,
    gap: 18,
  },
  heroExpandedHeader: {
    gap: 8,
    paddingRight: 24,
  },
  heroEyebrow: {
    ...brandTypography.heroEyebrow,
    color: brandSemanticColors.heroMetaOnDark,
  },
  heroTitleExpanded: {
    ...brandTypography.heroTitle,
    fontSize: 30,
    lineHeight: 34,
    color: brandColors.white,
  },
  heroBody: {
    ...brandTypography.heroBody,
    fontSize: 14,
    lineHeight: 20,
    color: brandSemanticColors.heroBodyOnDark,
  },
  heroStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignSelf: "flex-start",
  },
  heroStatTile: {
    borderColor: brandSemanticColors.heroPanelBorderOnDark,
    backgroundColor: brandSemanticColors.heroPanelBackgroundOnDark,
  },
  statTilePressed: {
    opacity: 0.7,
  },
  heroCompactLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingRight: 96,
    gap: 6,
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
    paddingBottom: 120,
    gap: 14,
  },
  pageContentNativeSearch: {
    paddingTop: 8,
  },

  // ── Filters ───────────────────────────────────────────────────────────────
  filtersStickyHost: {
    backgroundColor: brandColors.canvas,
    zIndex: 1,
    paddingBottom: 14,
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

  // ── Feature cards ─────────────────────────────────────────────────────────
  featureCard: {
    gap: 12,
  },
  homeSectionTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 21,
    lineHeight: 24,
  },
  homeSectionSubtitle: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  featureTitle: {
    ...brandTypography.input,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: brandColors.textPrimary,
  },
  featureBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  featureActions: {
    flexDirection: "row",
  },

  // ── Attention rows (P2-08) ────────────────────────────────────────────────
  attentionList: {
    gap: 8,
  },
  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: brandRadius.field,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  attentionRowIcon: {
    flexShrink: 0,
  },
  attentionRowCopy: {
    flex: 1,
    gap: 4,
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
  attentionRowTrailing: {
    alignItems: "flex-end",
    gap: 8,
  },

  // ── Create card ───────────────────────────────────────────────────────────
  createCard: {
    gap: 14,
  },
  createHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  createIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
  },
  createCopy: {
    flex: 1,
    gap: 4,
  },
  createTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 20,
    lineHeight: 23,
    color: brandColors.forest,
  },
  createBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  createButton: {
    alignSelf: "flex-start",
  },

  // ── List section header ───────────────────────────────────────────────────
  listSectionHeader: {
    paddingHorizontal: 2,
  },

  // ── Survey cards (P2-02: no progress bar, P2-03: simplified meta) ─────────
  surveyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: brandRadius.card,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
    padding: 12,
    ...brandShadow.card,
  },
  surveyCardSelected: {
    borderColor: brandComponentTokens.surveyList.cardSelectedBorder,
    backgroundColor: brandComponentTokens.surveyList.cardSelectedBackground,
  },
  surveyCardAccent: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 999,
    backgroundColor: brandComponentTokens.surveyList.cardAccentNeutral,
  },
  surveyCardAccentSuccess: {
    backgroundColor: brandComponentTokens.surveyList.cardAccentSuccess,
  },
  surveyCardAccentWarning: {
    backgroundColor: brandComponentTokens.surveyList.cardAccentWarning,
  },
  surveyCardAccentDanger: {
    backgroundColor: brandComponentTokens.surveyList.cardAccentDanger,
  },
  // P3-04: 72×96 (3:4 portrait ratio)
  surveyCardMedia: {
    width: 72,
    height: 96,
  },
  surveyCardPreview: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    backgroundColor: brandColors.panelMuted,
  },
  surveyCardPreviewPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
  },
  surveyCardContent: {
    flex: 1,
    gap: 6,
  },
  surveyCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  surveyCardTitle: {
    flex: 1,
    ...brandTypography.input,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: "800",
    color: brandColors.textPrimary,
  },
  surveyCardSelectedIcon: {
    marginTop: 2,
  },
  surveyCardStatusRow: {
    flexDirection: "row",
  },
  surveyCardMeta: {
    ...brandTypography.meta,
    fontSize: 11,
    lineHeight: 14,
    color: brandColors.textSecondary,
  },
  surveyCardSupport: {
    ...brandTypography.meta,
    fontSize: 11,
    lineHeight: 14,
    color: brandComponentTokens.surveyList.supportDangerText,
  },

  // ── Shared interaction ────────────────────────────────────────────────────
  rowPressed: {
    opacity: 0.82,
  },
  badgeTextDanger: {
    color: brandComponentTokens.surveyList.badgeDangerText,
  },

  // ── Empty states (P3-01: CTA) ─────────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    gap: 10,
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

  // ── FAB (P2-06) ───────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: brandColors.forest,
    alignItems: "center",
    justifyContent: "center",
    ...brandShadow.card,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
})
