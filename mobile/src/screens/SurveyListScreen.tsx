import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  brandColors,
  brandRadius,
  brandShadow,
  brandSpacing,
  brandTypography
} from '../app/brand-tokens';
import { formatDateTime } from '../app/formatters';
import {
  computeSurveyStats,
  formatSurveySyncDisplayLabel,
  formatSurveyWorkflowStatusLabel,
  resolveSurveySyncDisplay,
  resolveSurveyWorkflowStatus
} from '../app/survey-logic';
import {
  SurveyAttachmentFilter,
  SurveyBlockedFilter,
  SurveySort,
  SurveyStatusFilter,
  SurveyVisibilityFilter,
  SurveySyncFilter
} from '../app/types';
import { LocalAttachment, LocalSurvey } from '../storage';

type SurveyListScreenProps = {
  surveys: LocalSurvey[];
  visibleSurveys: LocalSurvey[];
  selectedSurveyId: string | null;
  attachmentsBySurvey: Record<string, LocalAttachment[]>;
  surveyFromDate: string;
  setSurveyFromDate: (value: string) => void;
  surveyToDate: string;
  setSurveyToDate: (value: string) => void;
  statusFilter: SurveyStatusFilter;
  setStatusFilter: (value: SurveyStatusFilter) => void;
  visibilityFilter: SurveyVisibilityFilter;
  setVisibilityFilter: (value: SurveyVisibilityFilter) => void;
  syncFilter: SurveySyncFilter;
  setSyncFilter: (value: SurveySyncFilter) => void;
  blockedFilter: SurveyBlockedFilter;
  setBlockedFilter: (value: SurveyBlockedFilter) => void;
  attachmentFilter: SurveyAttachmentFilter;
  setAttachmentFilter: (value: SurveyAttachmentFilter) => void;
  sortMode: SurveySort;
  setSortMode: (value: SurveySort) => void;
  resetFilters: () => void;
  searchActive: boolean;
  onOpenSurvey: (surveyId: string) => void;
};

type SurveyFilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

type SurveyStatTileProps = {
  label: string;
  value: number;
};

type SurveyBadgeTone = 'neutral' | 'success' | 'warning' | 'danger';
type SurveyRowTone = SurveyBadgeTone;

type SurveyBadgeProps = {
  label: string;
  tone?: SurveyBadgeTone;
};

const STATUS_OPTIONS: Array<{ label: string; value: SurveyStatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Expired', value: 'expired' }
];

const SYNC_OPTIONS: Array<{ label: string; value: SurveySyncFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Synced', value: 'synced' },
  { label: 'Failed', value: 'failed' }
];

const BLOCKED_OPTIONS: Array<{ label: string; value: SurveyBlockedFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Blocked only', value: 'blocked' },
  { label: 'Unblocked', value: 'unblocked' }
];

const ATTACHMENT_OPTIONS: Array<{ label: string; value: SurveyAttachmentFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'With photo', value: 'with' },
  { label: 'Without photo', value: 'without' }
];

const SORT_OPTIONS: Array<{ label: string; value: SurveySort }> = [
  { label: 'Updated (newest)', value: 'updated_desc' },
  { label: 'Updated (oldest)', value: 'updated_asc' },
  { label: 'Site A-Z', value: 'site_asc' }
];

function SurveyFilterChip({ label, active, onPress }: SurveyFilterChipProps) {
  return (
    <Pressable onPress={onPress} style={[screenStyles.filterChip, active ? screenStyles.filterChipActive : null]}>
      <Text style={[screenStyles.filterChipText, active ? screenStyles.filterChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function SurveyStatTile({ label, value }: SurveyStatTileProps) {
  return (
    <View style={screenStyles.heroStatTile}>
      <Text style={screenStyles.heroStatLabel}>{label}</Text>
      <Text style={screenStyles.heroStatValue}>{value}</Text>
    </View>
  );
}

function SurveyBadge({ label, tone = 'neutral' }: SurveyBadgeProps) {
  return (
    <View
      style={[
        screenStyles.badge,
        tone === 'success'
          ? screenStyles.badgeSuccess
          : tone === 'warning'
            ? screenStyles.badgeWarning
            : tone === 'danger'
              ? screenStyles.badgeDanger
              : screenStyles.badgeNeutral
      ]}
    >
      <Text style={[screenStyles.badgeText, tone === 'danger' ? screenStyles.badgeTextDanger : null]}>{label}</Text>
    </View>
  );
}

function resolveSurveyRowTone(
  workflowStatus: ReturnType<typeof resolveSurveyWorkflowStatus>,
  syncDisplay: ReturnType<typeof resolveSurveySyncDisplay>
): SurveyRowTone {
  if (syncDisplay === 'sync_error' || syncDisplay === 'sync_blocked') return 'danger';
  if (workflowStatus === 'submitted') return 'success';
  if (workflowStatus === 'expired') return 'danger';
  if (workflowStatus === 'pending') return 'warning';
  return 'neutral';
}

function FilterSection<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (next: T) => void;
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
  );
}

export function SurveyListScreen({
  surveys,
  visibleSurveys,
  selectedSurveyId,
  attachmentsBySurvey,
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
  searchActive,
  onOpenSurvey
}: SurveyListScreenProps) {
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const { height: viewportHeight } = useWindowDimensions();

  const surveyStats = useMemo(() => computeSurveyStats(surveys), [surveys]);
  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (surveyFromDate.trim()) count += 1;
    if (surveyToDate.trim()) count += 1;
    if (syncFilter !== 'all') count += 1;
    if (blockedFilter !== 'all') count += 1;
    if (attachmentFilter !== 'all') count += 1;
    if (sortMode !== 'updated_desc') count += 1;
    return count;
  }, [attachmentFilter, blockedFilter, sortMode, surveyFromDate, surveyToDate, syncFilter]);

  const compactSummary = useMemo(
    () => `${surveyStats.total} total • ${surveyStats.draft} drafts • ${surveyStats.pending} pending`,
    [surveyStats.draft, surveyStats.pending, surveyStats.total]
  );

  const expandedHeroHeight = Math.max(324, Math.min(388, Math.round(viewportHeight * 0.39)));
  const collapsedHeroHeight = 84;
  const collapseDistance = expandedHeroHeight - collapsedHeroHeight;

  const heroHeight = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [expandedHeroHeight, collapsedHeroHeight],
    extrapolate: 'clamp'
  });
  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.34, collapseDistance * 0.56],
    outputRange: [1, 0.22, 0],
    extrapolate: 'clamp'
  });
  const expandedTranslateY = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.56],
    outputRange: [0, -10],
    extrapolate: 'clamp'
  });
  const compactOpacity = scrollY.interpolate({
    inputRange: [collapseDistance * 0.4, collapseDistance * 0.68, collapseDistance],
    outputRange: [0, 0.6, 1],
    extrapolate: 'clamp'
  });
  const compactTranslateY = scrollY.interpolate({
    inputRange: [collapseDistance * 0.4, collapseDistance],
    outputRange: [8, 0],
    extrapolate: 'clamp'
  });
  const stickyFilterOffset = collapsedHeroHeight + brandSpacing.sm;
  const topSpacerHeight = searchActive ? brandSpacing.sm : expandedHeroHeight + brandSpacing.md;

  return (
    <View style={screenStyles.container}>
      {searchActive ? null : (
        <Animated.View
          pointerEvents="none"
          style={[
            screenStyles.heroShell,
            {
              height: heroHeight
            }
          ]}
        >
          <View style={screenStyles.heroCard}>
            <View style={screenStyles.heroAccentOrb} />
            <Animated.View
              style={[
                screenStyles.heroExpandedLayer,
                {
                  opacity: expandedOpacity,
                  transform: [{ translateY: expandedTranslateY }]
                }
              ]}
            >
              <View style={screenStyles.heroExpandedHeader}>
                <Text style={screenStyles.heroTitleExpanded}>Your field notebook</Text>
                <Text style={screenStyles.heroBody}>
                  Browse drafts, review sync state, and reopen surveys with less friction.
                </Text>
              </View>

              <View style={screenStyles.heroStatsGrid}>
                <SurveyStatTile label="TOTAL" value={surveyStats.total} />
                <SurveyStatTile label="DRAFTS" value={surveyStats.draft} />
                <SurveyStatTile label="SUBMITTED" value={surveyStats.submitted} />
                <SurveyStatTile label="PENDING" value={surveyStats.pending} />
              </View>
            </Animated.View>

            <Animated.View
              style={[
                screenStyles.heroCompactLayer,
                {
                  opacity: compactOpacity,
                  transform: [{ translateY: compactTranslateY }]
                }
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
      )}

      <Animated.ScrollView
        style={screenStyles.pageScroll}
        contentContainerStyle={screenStyles.pageContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        stickyHeaderIndices={searchActive ? undefined : [1]}
        contentInsetAdjustmentBehavior="automatic"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false
        })}
      >
        <View style={{ height: topSpacerHeight }} />

        {searchActive ? null : (
          <View
            style={[
              screenStyles.filtersStickyHost,
              {
                paddingTop: stickyFilterOffset,
                marginTop: -stickyFilterOffset
              }
            ]}
          >
            <View style={screenStyles.filtersCard}>
              <View style={screenStyles.filtersHeaderRow}>
                <View style={screenStyles.filtersHeadingBlock}>
                  <Text style={screenStyles.filtersTitle}>Find the right survey</Text>
                </View>

                <Pressable
                  style={screenStyles.advancedToggle}
                  onPress={() => setAdvancedFiltersOpen((current) => !current)}
                >
                  <Ionicons name={advancedFiltersOpen ? 'close' : 'funnel-outline'} size={16} color={brandColors.forest} />
                  <Text style={screenStyles.advancedToggleText}>
                    {advancedFiltersOpen ? 'Hide' : advancedFilterCount > 0 ? `${advancedFilterCount} active` : 'Filters'}
                  </Text>
                </Pressable>
              </View>

              <FilterSection label="Status" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
              {advancedFiltersOpen ? (
                <View style={screenStyles.advancedPanel}>
                  <View style={screenStyles.dateInputsRow}>
                    <View style={screenStyles.dateInputBlock}>
                      <Text style={screenStyles.filterSectionLabel}>From</Text>
                      <TextInput
                        style={screenStyles.compactInput}
                        value={surveyFromDate}
                        onChangeText={setSurveyFromDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={brandColors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                    <View style={screenStyles.dateInputBlock}>
                      <Text style={screenStyles.filterSectionLabel}>To</Text>
                      <TextInput
                        style={screenStyles.compactInput}
                        value={surveyToDate}
                        onChangeText={setSurveyToDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={brandColors.textSecondary}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>

                  <FilterSection label="Sync" options={SYNC_OPTIONS} value={syncFilter} onChange={setSyncFilter} />
                  <FilterSection label="Blocked" options={BLOCKED_OPTIONS} value={blockedFilter} onChange={setBlockedFilter} />
                  <FilterSection
                    label="Attachments"
                    options={ATTACHMENT_OPTIONS}
                    value={attachmentFilter}
                    onChange={setAttachmentFilter}
                  />
                  <FilterSection label="Sort" options={SORT_OPTIONS} value={sortMode} onChange={setSortMode} />

                  <Pressable onPress={resetFilters} style={screenStyles.resetButton}>
                    <Text style={screenStyles.resetButtonText}>Reset filters</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        )}

        <Text style={screenStyles.listHeaderMeta}>
          {visibleSurveys.length} {visibleSurveys.length > 1 ? 'surveys' : 'survey'}
          {surveys.length === visibleSurveys.length ? ' • All local records' : ` • Filtered from ${surveys.length}`}
        </Text>

        {visibleSurveys.map((survey) => {
          const attachments = attachmentsBySurvey[survey.id] ?? [];
          const firstAttachmentWithPreview = attachments.find((attachment) => Boolean(attachment.local_uri?.trim()));
          const completionRate = Math.max(0, Math.min(100, survey.completion_rate));
          const workflowStatus = resolveSurveyWorkflowStatus(survey);
          const syncDisplay = resolveSurveySyncDisplay(survey);
          const workflowLabel = formatSurveyWorkflowStatusLabel(workflowStatus);
          const supportText = survey.last_sync_error?.trim() ? survey.last_sync_error : null;
          const rowTone = resolveSurveyRowTone(workflowStatus, syncDisplay);
          const syncTone =
            syncDisplay === 'sync'
              ? 'success'
              : syncDisplay === 'sync_error' || syncDisplay === 'sync_blocked'
                ? 'danger'
                : 'neutral';

          return (
            <Pressable
              key={survey.id}
              style={[
                screenStyles.surveyCard,
                rowTone === 'success'
                  ? screenStyles.surveyCardSuccess
                  : rowTone === 'warning'
                    ? screenStyles.surveyCardWarning
                    : rowTone === 'danger'
                      ? screenStyles.surveyCardDanger
                      : null,
                selectedSurveyId === survey.id ? screenStyles.surveyCardSelected : null
              ]}
              onPress={() => onOpenSurvey(survey.id)}
            >
              <View
                style={[
                  screenStyles.surveyCardAccent,
                  rowTone === 'success'
                    ? screenStyles.surveyCardAccentSuccess
                    : rowTone === 'warning'
                      ? screenStyles.surveyCardAccentWarning
                      : rowTone === 'danger'
                        ? screenStyles.surveyCardAccentDanger
                        : null
                ]}
              />
              <View style={screenStyles.surveyCardMedia}>
                {firstAttachmentWithPreview?.local_uri ? (
                  <Image source={{ uri: firstAttachmentWithPreview.local_uri }} style={screenStyles.surveyCardPreview} />
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
                </View>

                <View style={screenStyles.surveyCardMetaBar}>
                  <View
                    style={[
                      screenStyles.workflowTag,
                      rowTone === 'success'
                        ? screenStyles.workflowTagSuccess
                        : rowTone === 'warning'
                          ? screenStyles.workflowTagWarning
                          : rowTone === 'danger'
                            ? screenStyles.workflowTagDanger
                            : null
                    ]}
                  >
                    <Text
                      style={[
                        screenStyles.workflowTagText,
                        rowTone === 'success'
                          ? screenStyles.workflowTagTextSuccess
                          : rowTone === 'warning'
                            ? screenStyles.workflowTagTextWarning
                            : rowTone === 'danger'
                              ? screenStyles.workflowTagTextDanger
                              : null
                      ]}
                    >
                      {workflowLabel}
                    </Text>
                  </View>
                  <Text style={screenStyles.surveyCardDate}>Updated {formatDateTime(survey.updated_at)}</Text>
                </View>

                {supportText ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      screenStyles.surveyCardSupport,
                      survey.last_sync_error?.trim() ? screenStyles.surveyCardSupportWarning : null
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
                        rowTone === 'success'
                          ? screenStyles.progressFillSuccess
                          : rowTone === 'warning'
                            ? screenStyles.progressFillWarning
                            : rowTone === 'danger'
                              ? screenStyles.progressFillDanger
                              : null,
                        { width: `${completionRate}%` }
                      ]}
                    />
                  </View>
                </View>

                <View style={screenStyles.badgeRow}>
                  <SurveyBadge label={formatSurveySyncDisplayLabel(syncDisplay)} tone={syncTone} />
                  <SurveyBadge label={survey.visibility === 'public' ? 'Public' : 'Private'} />
                </View>
              </View>
            </Pressable>
          );
        })}

        {surveys.length === 0 ? (
          <View style={screenStyles.emptyState}>
            <Ionicons name="leaf-outline" size={22} color={brandColors.forest} />
            <Text style={screenStyles.emptyStateTitle}>No survey yet</Text>
            <Text style={screenStyles.emptyStateBody}>
              Start a new IBP record to build your field notebook.
            </Text>
          </View>
        ) : null}

        {surveys.length > 0 && visibleSurveys.length === 0 ? (
          <View style={screenStyles.emptyState}>
            <Ionicons name="funnel-outline" size={22} color={brandColors.forest} />
            <Text style={screenStyles.emptyStateTitle}>No result with these filters</Text>
            <Text style={screenStyles.emptyStateBody}>
              Broaden the criteria or reset the advanced filters to see more surveys.
            </Text>
            <Pressable onPress={resetFilters} style={screenStyles.resetButton}>
              <Text style={screenStyles.resetButtonText}>Reset filters</Text>
            </Pressable>
          </View>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.canvas
  },
  heroShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingTop: 10,
    paddingHorizontal: 16
  },
  heroCard: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 34,
    backgroundColor: brandColors.forest,
    ...brandShadow.card
  },
  heroAccentOrb: {
    position: 'absolute',
    top: -18,
    right: -26,
    width: 132,
    height: 132,
    borderRadius: 999,
    backgroundColor: 'rgba(137, 163, 58, 0.22)'
  },
  heroExpandedLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 18,
    paddingHorizontal: 20
  },
  heroExpandedHeader: {
    gap: 10,
    paddingRight: 54
  },
  heroTitleExpanded: {
    ...brandTypography.heroTitle,
    fontSize: 33,
    lineHeight: 37,
    color: brandColors.white
  },
  heroBody: {
    ...brandTypography.heroBody,
    fontSize: 14,
    lineHeight: 20,
    color: '#E4ECD8'
  },
  heroStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  heroStatTile: {
    minWidth: '47%',
    flex: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2
  },
  heroStatLabel: {
    ...brandTypography.heroEyebrow,
    fontSize: 11,
    lineHeight: 13,
    color: '#D9E3C6'
  },
  heroStatValue: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
    color: brandColors.white
  },
  heroCompactLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingRight: 84,
    gap: 4
  },
  heroTitleCompact: {
    ...brandTypography.heroTitle,
    fontSize: 20,
    lineHeight: 22,
    color: brandColors.white
  },
  heroCompactSummary: {
    ...brandTypography.meta,
    color: '#D9E3C6'
  },
  pageScroll: {
    flex: 1
  },
  pageContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 120,
    gap: 14
  },
  filtersStickyHost: {
    backgroundColor: brandColors.canvas,
    zIndex: 1,
    paddingBottom: 14
  },
  filtersCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    padding: 14,
    gap: 8
  },
  filtersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10
  },
  filtersHeadingBlock: {
    flex: 1,
  },
  filtersTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 19,
    lineHeight: 22,
    color: brandColors.forest
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  advancedToggleText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  filterSection: {
    gap: 6
  },
  filterSectionLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: brandColors.forest,
    textTransform: 'uppercase'
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingRight: 8
  },
  filterChip: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  filterChipActive: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest
  },
  filterChipText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    color: brandColors.forest
  },
  filterChipTextActive: {
    color: brandColors.white
  },
  advancedPanel: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: brandColors.divider,
    paddingTop: 10
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 8
  },
  dateInputBlock: {
    flex: 1,
    gap: 4
  },
  compactInput: {
    minHeight: 40,
    borderRadius: brandRadius.field,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.inputFill,
    paddingHorizontal: 12,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600',
    color: brandColors.textPrimary
  },
  resetButton: {
    alignSelf: 'flex-start',
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.sage,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  resetButtonText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  listHeaderMeta: {
    ...brandTypography.meta,
    color: brandColors.textSecondary,
    paddingHorizontal: 2
  },
  surveyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: brandRadius.card,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
    padding: 12,
    ...brandShadow.card
  },
  surveyCardSuccess: {
    backgroundColor: '#F5F9EC',
    borderColor: '#D7E2C0'
  },
  surveyCardWarning: {
    backgroundColor: '#FBF4E9',
    borderColor: '#E5D0B0'
  },
  surveyCardDanger: {
    backgroundColor: '#FBF1EC',
    borderColor: '#E7CFC3'
  },
  surveyCardSelected: {
    borderColor: brandColors.forest,
    backgroundColor: '#F9FBF4'
  },
  surveyCardAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 999,
    backgroundColor: '#D7E0D1'
  },
  surveyCardAccentSuccess: {
    backgroundColor: brandColors.sage
  },
  surveyCardAccentWarning: {
    backgroundColor: brandColors.ochre
  },
  surveyCardAccentDanger: {
    backgroundColor: brandColors.terracotta
  },
  surveyCardMedia: {
    width: 72,
    height: 88
  },
  surveyCardPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    backgroundColor: brandColors.panelMuted
  },
  surveyCardPreviewPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColors.panelMuted
  },
  surveyCardContent: {
    flex: 1,
    gap: 6
  },
  surveyCardHeader: {
    gap: 3
  },
  surveyCardMetaBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8
  },
  surveyCardTitle: {
    ...brandTypography.input,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '800',
    color: brandColors.textPrimary
  },
  surveyCardDate: {
    ...brandTypography.meta,
    fontSize: 11,
    lineHeight: 14,
    color: brandColors.textSecondary
  },
  workflowTag: {
    borderRadius: brandRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E3E8DE'
  },
  workflowTagSuccess: {
    backgroundColor: '#DDE8C5'
  },
  workflowTagWarning: {
    backgroundColor: '#F0DEC4'
  },
  workflowTagDanger: {
    backgroundColor: '#F0D9D1'
  },
  workflowTagText: {
    ...brandTypography.meta,
    fontSize: 11,
    lineHeight: 13,
    color: brandColors.forest
  },
  workflowTagTextSuccess: {
    color: '#476329'
  },
  workflowTagTextWarning: {
    color: '#8B5517'
  },
  workflowTagTextDanger: {
    color: '#8A3E2B'
  },
  surveyCardSupport: {
    ...brandTypography.meta,
    fontSize: 11,
    lineHeight: 14,
    color: brandColors.textSecondary
  },
  surveyCardSupportWarning: {
    color: brandColors.terracotta
  },
  progressBlock: {
    gap: 4
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  progressLabel: {
    ...brandTypography.label,
    color: brandColors.forest
  },
  progressValue: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  progressTrack: {
    height: 8,
    borderRadius: brandRadius.pill,
    backgroundColor: '#DFE5D7',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.moss
  },
  progressFillSuccess: {
    backgroundColor: brandColors.moss
  },
  progressFillWarning: {
    backgroundColor: brandColors.ochre
  },
  progressFillDanger: {
    backgroundColor: brandColors.terracotta
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  badge: {
    borderRadius: brandRadius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  badgeText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  badgeTextDanger: {
    color: '#6B2E1C'
  },
  badgeNeutral: {
    backgroundColor: brandColors.panelMuted
  },
  badgeSuccess: {
    backgroundColor: brandColors.successSoft
  },
  badgeWarning: {
    backgroundColor: 'rgba(204, 112, 31, 0.18)'
  },
  badgeDanger: {
    backgroundColor: brandColors.errorSoft
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    borderRadius: brandRadius.card,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panel,
    paddingHorizontal: 18,
    paddingVertical: 22
  },
  emptyStateTitle: {
    ...brandTypography.input,
    color: brandColors.forest
  },
  emptyStateBody: {
    ...brandTypography.sectionBody,
    textAlign: 'center',
    color: brandColors.textSecondary
  }
});
