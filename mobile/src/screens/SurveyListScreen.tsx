import { useMemo, useRef, useState } from "react"
import {
  Animated,
  Image,
  Pressable,
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
import { formatDateTime } from "../app/formatters"
import {
  computeSurveyStats,
  formatSurveySyncDisplayLabel,
  formatSurveyUiStatusLabel,
  resolveSurveySyncDisplay,
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
import { LocalAttachment, LocalSurvey } from "../storage"
import { AppButton } from "../ui/AppButton"
import { AppCard } from "../ui/AppCard"
import { AppChoiceChip } from "../ui/AppChoiceChip"
import { AppField } from "../ui/AppField"
import { AppSectionHeader } from "../ui/AppSectionHeader"
import { AppStatusChip } from "../ui/AppStatusChip"

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
  onOpenCreateSurvey: () => void
  onOpenSurvey: (surveyId: string) => void
}

type SurveyFilterChipProps = {
  label: string
  active: boolean
  onPress: () => void
}

type SurveyStatTileProps = {
  label: string
  value: string
}

type SurveyBadgeTone = "neutral" | "success" | "warning" | "danger"
type SurveyRowTone = SurveyBadgeTone

type SurveyBadgeProps = {
  label: string
  tone?: SurveyBadgeTone
}

const STATUS_OPTIONS: Array<{ label: string; value: SurveyStatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Submitted", value: "submitted" },
  { label: "Expired", value: "expired" },
]

const SYNC_OPTIONS: Array<{ label: string; value: SurveySyncFilter }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Synced", value: "synced" },
  { label: "Failed", value: "failed" },
]

const BLOCKED_OPTIONS: Array<{ label: string; value: SurveyBlockedFilter }> = [
  { label: "All", value: "all" },
  { label: "Blocked only", value: "blocked" },
  { label: "Unblocked", value: "unblocked" },
]

const ATTACHMENT_OPTIONS: Array<{ label: string; value: SurveyAttachmentFilter }> = [
  { label: "All", value: "all" },
  { label: "With photo", value: "with" },
  { label: "Without photo", value: "without" },
]

const SORT_OPTIONS: Array<{ label: string; value: SurveySort }> = [
  { label: "Updated (newest)", value: "updated_desc" },
  { label: "Updated (oldest)", value: "updated_asc" },
  { label: "Site A-Z", value: "site_asc" },
]

function SurveyFilterChip({ label, active, onPress }: SurveyFilterChipProps) {
  return <AppChoiceChip label={label} active={active} onPress={onPress} />
}

function SurveyStatTile({ label, value }: SurveyStatTileProps) {
  return <AppStatusChip label={`${value} ${label}`} tone="onDark" style={screenStyles.heroStatTile} />
}

function SurveyBadge({ label, tone = "neutral" }: SurveyBadgeProps) {
  return (
    <AppStatusChip
      label={label}
      tone={tone}
      style={screenStyles.badge}
      labelStyle={tone === "danger" ? screenStyles.badgeTextDanger : undefined}
    />
  )
}

function resolveSurveyRowTone(
  uiStatus: ReturnType<typeof resolveSurveyUiStatus>,
): SurveyRowTone {
  if (uiStatus === "sync_error" || uiStatus === "sync_blocked" || uiStatus === "expired")
    return "danger"
  if (uiStatus === "submitted") return "success"
  if (uiStatus === "sync_pending") return "warning"
  return "neutral"
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
    <View style={screenStyles.filterSection}>
      <Text style={screenStyles.filterSectionLabel}>{label}</Text>
      <View style={screenStyles.filterChipRow}>
        {options.map((option) => (
          <SurveyFilterChip
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
  onOpenCreateSurvey,
  onOpenSurvey,
}: SurveyListScreenProps) {
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)
  const scrollY = useRef(new Animated.Value(0)).current
  const { height: viewportHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const trimmedQuery = surveyQuery.trim()
  const showHero = !useNativeSearchUI
  const showFiltersPanel = useNativeSearchUI || showInlineSearch

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

  const compactSummary = useMemo(
    () =>
      `${surveyStats.total} surveys • ${surveyStats.draft} drafts • ${surveyStats.pending} pending sync`,
    [surveyStats.draft, surveyStats.pending, surveyStats.total],
  )
  const heroStats = useMemo(
    () => [
      { label: "total", value: String(surveyStats.total) },
      { label: "drafts", value: String(surveyStats.draft) },
      {
        label:
          surveyStats.blocked > 0
            ? "blocked"
            : surveyStats.pending > 0
              ? "pending sync"
              : "submitted",
        value: String(
          surveyStats.blocked > 0
            ? surveyStats.blocked
            : surveyStats.pending > 0
              ? surveyStats.pending
              : surveyStats.submitted,
        ),
      },
    ],
    [surveyStats.blocked, surveyStats.draft, surveyStats.pending, surveyStats.submitted, surveyStats.total],
  )
  const visibleSurveySummary = useMemo(() => {
    if (surveys.length === 0) return "No local survey yet"
    if (trimmedQuery.length > 0) {
      return `${visibleSurveys.length} ${visibleSurveys.length > 1 ? "results" : "result"} for "${trimmedQuery}"`
    }
    if (visibleSurveys.length === surveys.length) {
      return `${visibleSurveys.length} ${visibleSurveys.length > 1 ? "surveys" : "survey"} shown`
    }

    return `${visibleSurveys.length} of ${surveys.length} surveys shown`
  }, [surveys.length, trimmedQuery, visibleSurveys.length])
  const filtersSummaryLabel =
    advancedFilterCount > 0 ? `${advancedFilterCount} filters active` : visibleSurveySummary
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

  return (
    <View style={screenStyles.container}>
      {showHero ? (
        <Animated.View
          pointerEvents="none"
          style={[
            screenStyles.heroShell,
            {
              height: heroShellHeight,
              paddingTop: heroTopInset,
            },
          ]}
        >
          <View style={screenStyles.heroCard}>
            <View style={screenStyles.heroAccentOrb} />
            <Animated.View
              style={[
                screenStyles.heroExpandedLayer,
                {
                  opacity: expandedOpacity,
                  transform: [{ translateY: expandedTranslateY }],
                },
              ]}
            >
              <View style={screenStyles.heroExpandedHeader}>
                <Text style={screenStyles.heroEyebrow}>HOME</Text>
                <Text style={screenStyles.heroTitleExpanded}>Your field notebook</Text>
                <Text style={screenStyles.heroBody}>
                  Keep drafts, sync issues, and reopened records in one place.
                </Text>
              </View>

              <View style={screenStyles.heroStatsGrid}>
                {heroStats.map((stat) => (
                  <SurveyStatTile key={stat.label} label={stat.label} value={stat.value} />
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
              <Text numberOfLines={1} style={screenStyles.heroTitleCompact}>
                Your field notebook
              </Text>
              <Text numberOfLines={1} style={screenStyles.heroCompactSummary}>
                {compactSummary}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      ) : null}

      <Animated.ScrollView
        style={screenStyles.pageScroll}
        contentContainerStyle={[
          screenStyles.pageContent,
          useNativeSearchUI ? screenStyles.pageContentNativeSearch : null,
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        stickyHeaderIndices={showFiltersPanel ? (useNativeSearchUI ? [0] : [1]) : undefined}
        contentInsetAdjustmentBehavior={useNativeSearchUI ? "automatic" : "never"}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
      >
        {showHero ? <View style={{ height: topSpacerHeight }} /> : null}

        {showFiltersPanel ? (
          <View
            style={[
              screenStyles.filtersStickyHost,
              useNativeSearchUI
                ? screenStyles.filtersStickyHostNativeSearch
                : {
                    paddingTop: stickyFilterOffset,
                    marginTop: -stickyFilterOffset,
                  },
            ]}
          >
            <AppCard variant="panelElevated" padding={14} style={screenStyles.filtersCard}>
              <View style={screenStyles.filtersHeaderRow}>
                {useNativeSearchUI ? (
                  <AppSectionHeader
                    title="Refine results"
                    subtitle={filtersSummaryLabel}
                    style={screenStyles.filtersHeadingBlock}
                    titleStyle={screenStyles.filtersTitle}
                    subtitleStyle={screenStyles.filtersSubtitle}
                  />
                ) : (
                  <View style={screenStyles.filtersHeadingBlock}>
                    <View style={screenStyles.filtersCompactTitleRow}>
                      <Ionicons name="funnel-outline" size={14} color={brandColors.forest} />
                      <Text style={screenStyles.filtersCompactTitle}>Filters</Text>
                    </View>
                    <Text numberOfLines={1} style={screenStyles.filtersCompactMeta}>
                      {filtersSummaryLabel}
                    </Text>
                  </View>
                )}

                <Pressable
                  accessibilityLabel={advancedFiltersOpen ? "Hide advanced filters" : "Show advanced filters"}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: advancedFiltersOpen }}
                  style={screenStyles.advancedToggle}
                  onPress={() => setAdvancedFiltersOpen((current) => !current)}
                >
                  <Ionicons
                    name={advancedFiltersOpen ? "close" : "funnel-outline"}
                    size={16}
                    color={brandColors.forest}
                  />
                  <Text style={screenStyles.advancedToggleText}>
                    {advancedFiltersOpen
                      ? "Hide"
                      : advancedFilterCount > 0
                        ? `${advancedFilterCount} active`
                        : "Filters"}
                  </Text>
                </Pressable>
              </View>

              {showInlineSearch ? (
                <View style={screenStyles.searchRow}>
                  <View style={screenStyles.searchField}>
                    <Ionicons
                      name="search-outline"
                      size={18}
                      color={brandColors.textSecondary}
                    />
                    <TextInput
                      value={surveyQuery}
                      onChangeText={setSurveyQuery}
                      placeholder="Search by site name"
                      placeholderTextColor={brandColors.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                      clearButtonMode="while-editing"
                      style={screenStyles.searchInput}
                    />
                    {trimmedQuery.length > 0 ? (
                      <Pressable
                        accessibilityLabel="Clear search query"
                        accessibilityRole="button"
                        hitSlop={10}
                        onPress={() => setSurveyQuery("")}
                        style={screenStyles.searchClearButton}
                      >
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color={brandColors.textSecondary}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <FilterSection
                label="Status"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              {advancedFiltersOpen ? (
                <View style={screenStyles.advancedPanel}>
                  <View style={screenStyles.dateInputsRow}>
                    <AppField
                      label="From"
                      value={surveyFromDate}
                      onChangeText={setSurveyFromDate}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      autoCorrect={false}
                      containerStyle={screenStyles.dateInputBlock}
                      labelStyle={screenStyles.filterSectionLabel}
                      inputStyle={screenStyles.compactInput}
                    />
                    <AppField
                      label="To"
                      value={surveyToDate}
                      onChangeText={setSurveyToDate}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      autoCorrect={false}
                      containerStyle={screenStyles.dateInputBlock}
                      labelStyle={screenStyles.filterSectionLabel}
                      inputStyle={screenStyles.compactInput}
                    />
                  </View>

                  <FilterSection
                    label="Sync"
                    options={SYNC_OPTIONS}
                    value={syncFilter}
                    onChange={setSyncFilter}
                  />
                  <FilterSection
                    label="Blocked"
                    options={BLOCKED_OPTIONS}
                    value={blockedFilter}
                    onChange={setBlockedFilter}
                  />
                  <FilterSection
                    label="Attachments"
                    options={ATTACHMENT_OPTIONS}
                    value={attachmentFilter}
                    onChange={setAttachmentFilter}
                  />
                  <FilterSection
                    label="Sort"
                    options={SORT_OPTIONS}
                    value={sortMode}
                    onChange={setSortMode}
                  />

                  <AppButton
                    label="Reset filters"
                    variant="secondary"
                    size="sm"
                    onPress={resetFilters}
                    style={screenStyles.resetButton}
                    labelStyle={screenStyles.resetButtonText}
                  />
                </View>
              ) : null}
            </AppCard>
          </View>
        ) : null}

        {showHero ? (
          <AppCard variant="surface" padding={16} style={screenStyles.createSurveyCard}>
            <View style={screenStyles.createSurveyHeader}>
              <View style={screenStyles.createSurveyIconWrap}>
                <Ionicons name="add-outline" size={20} color={brandColors.forest} />
              </View>
              <View style={screenStyles.createSurveyCopy}>
                <Text style={screenStyles.createSurveyTitle}>Create a new survey</Text>
                <Text style={screenStyles.createSurveyBody}>
                  Start a fresh field notebook and capture new field observations.
                </Text>
              </View>
            </View>
            <AppButton
              label="Start survey"
              size="md"
              leadingIcon="arrow-forward-outline"
              onPress={onOpenCreateSurvey}
              style={screenStyles.createSurveyButton}
            />
          </AppCard>
        ) : null}

        {showHero && continueDraftSurvey ? (
          <AppCard variant="surface" padding={16} style={screenStyles.homeFeatureCard}>
            <AppSectionHeader
              title="Continue draft"
              subtitle={`Updated ${formatDateTime(continueDraftSurvey.updated_at)}`}
              titleStyle={screenStyles.homeSectionTitle}
              subtitleStyle={screenStyles.homeSectionSubtitle}
              trailing={
                <SurveyBadge
                  label={formatSurveyUiStatusLabel(resolveSurveyUiStatus(continueDraftSurvey))}
                  tone={resolveSurveyRowTone(resolveSurveyUiStatus(continueDraftSurvey))}
                />
              }
            />
            <Text style={screenStyles.homeFeatureTitle}>{continueDraftSurvey.site_name}</Text>
            <Text style={screenStyles.homeFeatureBody}>
              {continueDraftSurvey.completion_rate}% complete. Pick up where you left off.
            </Text>
            <View style={screenStyles.homeFeatureActions}>
              <AppButton
                label="Continue"
                size="sm"
                leadingIcon="arrow-forward-outline"
                onPress={() => onOpenSurvey(continueDraftSurvey.id)}
              />
            </View>
          </AppCard>
        ) : null}

        {showHero && attentionSurveys.length > 0 ? (
          <AppCard variant="surface" padding={16} style={screenStyles.homeFeatureCard}>
            <AppSectionHeader
              title="Needs attention"
              subtitle={`${attentionSurveys.length} survey${attentionSurveys.length > 1 ? "s" : ""} to review`}
              titleStyle={screenStyles.homeSectionTitle}
              subtitleStyle={screenStyles.homeSectionSubtitle}
            />
            <View style={screenStyles.attentionList}>
              {attentionSurveys.map((survey) => {
                const uiStatus = resolveSurveyUiStatus(survey)
                const rowTone = resolveSurveyRowTone(uiStatus)

                return (
                  <Pressable
                    key={survey.id}
                    accessibilityRole="button"
                    onPress={() => onOpenSurvey(survey.id)}
                    style={screenStyles.attentionRow}
                  >
                    <View style={screenStyles.attentionRowCopy}>
                      <Text numberOfLines={1} style={screenStyles.attentionRowTitle}>
                        {survey.site_name}
                      </Text>
                      <Text numberOfLines={2} style={screenStyles.attentionRowMeta}>
                        {survey.last_sync_error?.trim()
                          ? survey.last_sync_error
                          : `Updated ${formatDateTime(survey.updated_at)}`}
                      </Text>
                    </View>
                    <View style={screenStyles.attentionRowTrailing}>
                      <SurveyBadge label={formatSurveyUiStatusLabel(uiStatus)} tone={rowTone} />
                      <Ionicons name="chevron-forward" size={16} color={brandColors.textSecondary} />
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </AppCard>
        ) : null}

        {visibleSurveys.length > 0 || (useNativeSearchUI && surveys.length > 0) ? (
          <AppSectionHeader
            title={useNativeSearchUI ? "Results" : "My surveys"}
            subtitle={visibleSurveySummary}
            titleStyle={screenStyles.homeSectionTitle}
            subtitleStyle={screenStyles.homeSectionSubtitle}
            style={screenStyles.listSectionHeader}
          />
        ) : null}

        {visibleSurveys.map((survey) => {
          const attachments = attachmentsBySurvey[survey.id] ?? []
          const firstAttachmentWithPreview = attachments.find((attachment) =>
            Boolean(attachment.local_uri?.trim()),
          )
          const completionRate = Math.max(0, Math.min(100, survey.completion_rate))
          const uiStatus = resolveSurveyUiStatus(survey)
          const syncDisplay = resolveSurveySyncDisplay(survey)
          const uiStatusLabel = formatSurveyUiStatusLabel(uiStatus)
          const supportText = survey.last_sync_error?.trim() ? survey.last_sync_error : null
          const rowTone = resolveSurveyRowTone(uiStatus)
          const isSelected = selectedSurveyId === survey.id
          const visibilityLabel = survey.visibility === "public" ? "Public" : "Private"
          const metaSummary = `${formatSurveySyncDisplayLabel(syncDisplay)} • ${visibilityLabel} • Updated ${formatDateTime(
            survey.updated_at,
          )}`

          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={survey.id}
              style={[
                screenStyles.surveyCard,
                isSelected ? screenStyles.surveyCardSelected : null,
              ]}
              onPress={() => onOpenSurvey(survey.id)}
            >
              <View
                style={[
                  screenStyles.surveyCardAccent,
                  rowTone === "success"
                    ? screenStyles.surveyCardAccentSuccess
                    : rowTone === "warning"
                      ? screenStyles.surveyCardAccentWarning
                      : rowTone === "danger"
                        ? screenStyles.surveyCardAccentDanger
                        : null,
                ]}
              />
              <View style={screenStyles.surveyCardMedia}>
                {firstAttachmentWithPreview?.local_uri ? (
                  <Image
                    source={{ uri: firstAttachmentWithPreview.local_uri }}
                    style={screenStyles.surveyCardPreview}
                  />
                ) : (
                  <View style={screenStyles.surveyCardPreviewPlaceholder}>
                    <Ionicons name="image-outline" size={22} color={brandColors.textSecondary} />
                  </View>
                )}
              </View>

              <View style={screenStyles.surveyCardContent}>
                <View style={screenStyles.surveyCardHeader}>
                  <Text numberOfLines={2} style={screenStyles.surveyCardTitle}>
                    {survey.site_name}
                  </Text>
                  {isSelected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={brandColors.forest}
                      style={screenStyles.surveyCardSelectedIcon}
                    />
                  ) : null}
                </View>

                <View style={screenStyles.surveyCardStatusRow}>
                  <SurveyBadge label={uiStatusLabel} tone={rowTone} />
                </View>

                <View style={screenStyles.surveyCardMetaBar}>
                  <Text numberOfLines={2} style={screenStyles.surveyCardMeta}>
                    {metaSummary}
                  </Text>
                </View>

                {supportText ? (
                  <Text
                    numberOfLines={2}
                    style={[
                      screenStyles.surveyCardSupport,
                      survey.last_sync_error?.trim() ? screenStyles.surveyCardSupportWarning : null,
                    ]}
                  >
                    {supportText}
                  </Text>
                ) : null}

                <View style={screenStyles.progressBlock}>
                  <View style={screenStyles.progressHeader}>
                    <Text style={screenStyles.progressLabel}>Completion</Text>
                    <Text style={screenStyles.progressValue}>{completionRate}%</Text>
                  </View>
                  <View style={screenStyles.progressTrack}>
                    <View
                      style={[
                        screenStyles.progressFill,
                        rowTone === "success"
                          ? screenStyles.progressFillSuccess
                          : rowTone === "warning"
                            ? screenStyles.progressFillWarning
                            : rowTone === "danger"
                              ? screenStyles.progressFillDanger
                              : null,
                        { width: `${completionRate}%` },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </Pressable>
          )
        })}

        {surveys.length === 0 ? (
          <AppCard variant="panelElevated" padding={22} style={screenStyles.emptyState}>
            <Ionicons name="leaf-outline" size={22} color={brandColors.forest} />
            <Text style={screenStyles.emptyStateTitle}>No survey yet</Text>
            <Text style={screenStyles.emptyStateBody}>
              Start a new IBP record to build your field notebook.
            </Text>
          </AppCard>
        ) : null}

        {surveys.length > 0 && visibleSurveys.length === 0 ? (
          <AppCard variant="panelElevated" padding={22} style={screenStyles.emptyState}>
            <Ionicons name="funnel-outline" size={22} color={brandColors.forest} />
            <Text style={screenStyles.emptyStateTitle}>No result with these filters</Text>
            <Text style={screenStyles.emptyStateBody}>
              Broaden the criteria or reset the advanced filters to see more surveys.
            </Text>
            <AppButton
              label="Reset filters"
              variant="secondary"
              size="sm"
              onPress={resetFilters}
              style={screenStyles.resetButton}
              labelStyle={screenStyles.resetButtonText}
            />
          </AppCard>
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
  createSurveyCard: {
    gap: 14,
  },
  createSurveyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  createSurveyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: brandColors.panelMuted,
  },
  createSurveyCopy: {
    flex: 1,
    gap: 4,
  },
  createSurveyTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 20,
    lineHeight: 23,
    color: brandColors.forest,
  },
  createSurveyBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  createSurveyButton: {
    alignSelf: "flex-start",
  },
  homeFeatureCard: {
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
  homeFeatureTitle: {
    ...brandTypography.input,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: brandColors.textPrimary,
  },
  homeFeatureBody: {
    ...brandTypography.sectionBody,
    color: brandColors.textSecondary,
  },
  homeFeatureActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  attentionList: {
    gap: 10,
  },
  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: brandRadius.field,
    backgroundColor: brandColors.panel,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  listSectionHeader: {
    paddingHorizontal: 2,
  },
  filtersHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  filtersHeadingBlock: {
    flex: 1,
  },
  filtersCompactTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filtersCompactTitle: {
    ...brandTypography.meta,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
    color: brandColors.forest,
    textTransform: "uppercase",
  },
  filtersCompactMeta: {
    ...brandTypography.meta,
    marginTop: 4,
    color: brandColors.textSecondary,
  },
  filtersTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 19,
    lineHeight: 22,
    color: brandColors.forest,
  },
  filtersSubtitle: {
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
    minHeight: 44,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
  },
  resetButton: {
    alignSelf: "flex-start",
  },
  resetButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest,
  },
  surveyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: brandRadius.card,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
    padding: 14,
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
  surveyCardMedia: {
    width: 72,
    height: 88,
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
    gap: 8,
  },
  surveyCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  surveyCardSelectedIcon: {
    marginTop: 2,
  },
  surveyCardStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  surveyCardMetaBar: {
    gap: 4,
  },
  surveyCardTitle: {
    ...brandTypography.input,
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: brandColors.textPrimary,
  },
  surveyCardMeta: {
    ...brandTypography.meta,
    fontSize: 12,
    lineHeight: 16,
    color: brandColors.textSecondary,
  },
  surveyCardSupport: {
    ...brandTypography.meta,
    fontSize: 12,
    lineHeight: 16,
    color: brandColors.textSecondary,
  },
  surveyCardSupportWarning: {
    color: brandComponentTokens.surveyList.supportDangerText,
  },
  progressBlock: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    ...brandTypography.label,
    color: brandColors.forest,
  },
  progressValue: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
  },
  progressTrack: {
    height: 8,
    borderRadius: brandRadius.pill,
    backgroundColor: brandComponentTokens.surveyList.progressTrack,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.moss,
  },
  progressFillSuccess: {
    backgroundColor: brandColors.moss,
  },
  progressFillWarning: {
    backgroundColor: brandColors.ochre,
  },
  progressFillDanger: {
    backgroundColor: brandColors.terracotta,
  },
  badge: {
    borderRadius: brandRadius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeTextDanger: {
    color: brandComponentTokens.surveyList.badgeDangerText,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
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
