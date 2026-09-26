import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Platform,
  ListRenderItemInfo,
  RefreshControl,
  View,
  useWindowDimensions,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { brandColors, brandSpacing } from "../app/brand-tokens"
import { computeSurveyStats } from "../app/survey-logic"
import { useAppBottomTabBarHeight } from "../app/useAppBottomTabBarHeight"
import type { LocalAttachment } from "../storage"
import {
  isPhotoAttachment,
  resolveAttachmentPreview,
  selectPreviewCandidates,
} from "./survey-screen-helpers"
import { pickAttentionSurveys, pickContinueDraft } from "./survey-list/AttentionSection"
import { FilterBar } from "./survey-list/FilterBar"
import { ListEmptyState } from "./survey-list/ListEmptyState"
import { ListHero, useHeroGeometry } from "./survey-list/ListHero"
import { isLeadingListItem, keyExtractor, useLeadingItems } from "./survey-list/leading-items"
import type { SurveyListItem } from "./survey-list/leading-items"
import { SurveyRow } from "./survey-list/SurveyRow"
import type { SurveyRowPreview } from "./survey-list/SurveyRow"
import { PAGE_CONTENT_GAP, styles } from "./survey-list/styles"
import type { SurveyListScreenProps } from "./survey-list/types"

// D-03: rows mounted on the first render and per batch; the leading items come on top.
const INITIAL_ROWS = 10
const STICKY_HEADER_INDICES = [0]

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
  const [refreshing, setRefreshing] = useState(false)
  const scrollY = useRef(new Animated.Value(0)).current
  const { height: viewportHeight, width: windowWidth } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const tabBarHeight = useAppBottomTabBarHeight(Platform.select({ ios: 84, default: 68 }) ?? 68)
  const heroGeometry = useHeroGeometry(viewportHeight, insets.top)
  const trimmedQuery = surveyQuery.trim()
  const showHero = !useNativeSearchUI
  // The create card and the "À faire" card stay on Mes Relevés; only an
  // active native header search replaces them with the results (D-08).
  const showFeatured = showHero || trimmedQuery.length === 0
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

  const totalFilterCount = advancedFilterCount + (statusFilter !== "all" ? 1 : 0)

  // ── Featured cards content ──────────────────────────────────────────────────

  const continueDraftSurvey = useMemo(() => pickContinueDraft(surveys), [surveys])

  const attentionSurveys = useMemo(
    () => pickAttentionSurveys(surveys, continueDraftSurvey?.id),
    [continueDraftSurvey?.id, surveys],
  )

  // ── Main list — deduplicated ────────────────────────────────────────────────

  const excludedIds = useMemo(() => {
    const ids = new Set<string>()
    if (continueDraftSurvey) ids.add(continueDraftSurvey.id)
    attentionSurveys.forEach((s) => ids.add(s.id))
    return ids
  }, [continueDraftSurvey, attentionSurveys])

  const mainListSurveys = useMemo(
    () => (showFeatured ? visibleSurveys.filter((s) => !excludedIds.has(s.id)) : visibleSurveys),
    [showFeatured, visibleSurveys, excludedIds],
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

  const filtersSummaryLabel =
    totalFilterCount > 0
      ? `${totalFilterCount} filtre${totalFilterCount > 1 ? "s" : ""} actif${totalFilterCount > 1 ? "s" : ""}`
      : visibleSurveySummary

  // ── Layout under the hero ───────────────────────────────────────────────────

  const { expandedHeroHeight, collapsedHeroHeight, heroTopInset } = heroGeometry
  const stickyFilterOffset = heroTopInset + collapsedHeroHeight + brandSpacing.sm
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

  // ── List header: the sticky filters bar (sticky index 0), memoised ─────────

  const filtersHeader = useMemo(
    () =>
      showFiltersPanel ? (
        <FilterBar
          useNativeSearchUI={useNativeSearchUI}
          stickyFilterOffset={stickyFilterOffset}
          summaryLabel={filtersSummaryLabel}
          advancedFilterCount={advancedFilterCount}
          showInlineSearch={showInlineSearch}
          surveyQuery={surveyQuery}
          setSurveyQuery={setSurveyQuery}
          surveyFromDate={surveyFromDate}
          setSurveyFromDate={setSurveyFromDate}
          surveyToDate={surveyToDate}
          setSurveyToDate={setSurveyToDate}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          syncFilter={syncFilter}
          setSyncFilter={setSyncFilter}
          blockedFilter={blockedFilter}
          setBlockedFilter={setBlockedFilter}
          attachmentFilter={attachmentFilter}
          setAttachmentFilter={setAttachmentFilter}
          sortMode={sortMode}
          setSortMode={setSortMode}
          resetFilters={resetFilters}
        />
      ) : null,
    [
      advancedFilterCount,
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
      useNativeSearchUI,
    ],
  )

  // ── Leading list items: create card, "À faire" card, section header ────────

  const leadingItems = useLeadingItems({
    showFeatured,
    useNativeSearchUI,
    surveyCount: surveys.length,
    visibleCount: visibleSurveys.length,
    mainListCount: mainListSurveys.length,
    visibleSurveySummary,
    attentionSurveys,
    continueDraftSurvey,
    onOpenCreateSurvey,
    onOpenSurvey,
  })

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

  const showEmptyState = surveys.length === 0 || visibleSurveys.length === 0
  const listFooter = useMemo(
    () => (
      <>
        {showEmptyState ? (
          <ListEmptyState noSurveys={surveys.length === 0} resetFilters={resetFilters} />
        ) : null}
        {showHero ? <View style={{ height: brandSpacing.xl }} /> : null}
      </>
    ),
    [resetFilters, showEmptyState, showHero, surveys.length],
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {showHero ? (
        <ListHero
          scrollY={scrollY}
          geometry={heroGeometry}
          cardWidth={windowWidth - 32 /* 16pt padding each side */}
          stats={surveyStats}
          surveyCount={surveys.length}
          visibleCount={visibleSurveys.length}
          totalFilterCount={totalFilterCount}
          attentionCount={attentionSurveys.length}
          continueDraftName={continueDraftSurvey?.site_name ?? null}
          resetFilters={resetFilters}
          setStatusFilter={setStatusFilter}
          setSyncFilter={setSyncFilter}
          setBlockedFilter={setBlockedFilter}
        />
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
