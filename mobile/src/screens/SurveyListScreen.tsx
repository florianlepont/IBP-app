import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
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
  surveyQuery: string;
  setSurveyQuery: (value: string) => void;
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

const VISIBILITY_OPTIONS: Array<{ label: string; value: SurveyVisibilityFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Private', value: 'private' },
  { label: 'Public', value: 'public' }
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
  surveyQuery,
  setSurveyQuery,
  surveyFromDate,
  setSurveyFromDate,
  surveyToDate,
  setSurveyToDate,
  statusFilter,
  setStatusFilter,
  visibilityFilter,
  setVisibilityFilter,
  syncFilter,
  setSyncFilter,
  blockedFilter,
  setBlockedFilter,
  attachmentFilter,
  setAttachmentFilter,
  sortMode,
  setSortMode,
  resetFilters,
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

  return (
    <View style={screenStyles.container}>
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

      <Animated.ScrollView
        style={screenStyles.pageScroll}
        contentContainerStyle={screenStyles.pageContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false
        })}
      >
        <View style={{ height: expandedHeroHeight + brandSpacing.md }} />

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
              <Text style={screenStyles.filtersBody}>Use quick filters first, then refine only when needed.</Text>
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

          <View style={screenStyles.searchField}>
            <Ionicons name="search-outline" size={18} color={brandColors.textSecondary} />
            <TextInput
              style={screenStyles.searchInput}
              value={surveyQuery}
              onChangeText={setSurveyQuery}
              placeholder="Search by site, id, or sync issue"
              placeholderTextColor={brandColors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <FilterSection label="Status" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <FilterSection
            label="Visibility"
            options={VISIBILITY_OPTIONS}
            value={visibilityFilter}
            onChange={setVisibilityFilter}
          />

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

        <Text style={screenStyles.listHeaderMeta}>
          {visibleSurveys.length} {visibleSurveys.length > 1 ? 'surveys' : 'survey'}
          {surveys.length === visibleSurveys.length ? ' • All local records' : ` • Filtered from ${surveys.length}`}
        </Text>

        {visibleSurveys.map((survey) => {
          const attachments = attachmentsBySurvey[survey.id] ?? [];
          const firstAttachmentWithPreview = attachments.find((attachment) => Boolean(attachment.local_uri?.trim()));
          const attachmentCount = attachments.length;
          const completionRate = Math.max(0, Math.min(100, survey.completion_rate));
          const workflowStatus = resolveSurveyWorkflowStatus(survey);
          const syncDisplay = resolveSurveySyncDisplay(survey);
          const supportText = survey.last_sync_error?.trim()
            ? survey.last_sync_error
            : `Created ${formatDateTime(survey.created_at)}`;
          const workflowTone =
            workflowStatus === 'submitted'
              ? 'success'
              : workflowStatus === 'expired'
                ? 'danger'
                : workflowStatus === 'pending'
                  ? 'warning'
                  : 'neutral';
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
                selectedSurveyId === survey.id ? screenStyles.surveyCardSelected : null
              ]}
              onPress={() => onOpenSurvey(survey.id)}
            >
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
                  <Text style={screenStyles.surveyCardTitle}>{survey.site_name}</Text>
                  <Text style={screenStyles.surveyCardDate}>{formatDateTime(survey.updated_at)}</Text>
                </View>

                <View style={screenStyles.surveyCardMetaRow}>
                  <View style={screenStyles.inlineMeta}>
                    <Ionicons name="images-outline" size={14} color={brandColors.textSecondary} />
                    <Text style={screenStyles.inlineMetaText}>
                      {attachmentCount} {attachmentCount > 1 ? 'photos' : 'photo'}
                    </Text>
                  </View>
                  <View style={screenStyles.inlineMeta}>
                    <Ionicons name="document-text-outline" size={14} color={brandColors.textSecondary} />
                    <Text style={screenStyles.inlineMetaText}>{survey.id}</Text>
                  </View>
                </View>

                <Text
                  numberOfLines={2}
                  style={[
                    screenStyles.surveyCardSupport,
                    survey.last_sync_error?.trim() ? screenStyles.surveyCardSupportWarning : null
                  ]}
                >
                  {supportText}
                </Text>

                <View style={screenStyles.progressBlock}>
                  <View style={screenStyles.progressHeader}>
                    <Text style={screenStyles.progressLabel}>Completion</Text>
                    <Text style={screenStyles.progressValue}>{completionRate}%</Text>
                  </View>
                  <View style={screenStyles.progressTrack}>
                    <View style={[screenStyles.progressFill, { width: `${completionRate}%` }]} />
                  </View>
                </View>

                <View style={screenStyles.badgeRow}>
                  <SurveyBadge label={formatSurveyWorkflowStatusLabel(workflowStatus)} tone={workflowTone} />
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
    padding: 16,
    gap: 14
  },
  filtersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  filtersHeadingBlock: {
    flex: 1,
    gap: 4
  },
  filtersTitle: {
    ...brandTypography.sectionTitle,
    fontSize: 22,
    lineHeight: 24,
    color: brandColors.forest
  },
  filtersBody: {
    ...brandTypography.sectionBody,
    fontSize: 13,
    lineHeight: 19,
    color: brandColors.textSecondary
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  advancedToggleText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    borderRadius: brandRadius.field,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.inputFill,
    paddingHorizontal: 14
  },
  searchInput: {
    flex: 1,
    ...brandTypography.input,
    color: brandColors.textPrimary
  },
  filterSection: {
    gap: 8
  },
  filterSectionLabel: {
    ...brandTypography.label,
    color: brandColors.forest,
    textTransform: 'uppercase'
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingRight: 8
  },
  filterChip: {
    borderRadius: brandRadius.pill,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.panelMuted,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  filterChipActive: {
    borderColor: brandColors.forest,
    backgroundColor: brandColors.forest
  },
  filterChipText: {
    ...brandTypography.meta,
    color: brandColors.forest
  },
  filterChipTextActive: {
    color: brandColors.white
  },
  advancedPanel: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: brandColors.divider,
    paddingTop: 12
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 10
  },
  dateInputBlock: {
    flex: 1,
    gap: 6
  },
  compactInput: {
    minHeight: 46,
    borderRadius: brandRadius.field,
    borderWidth: 1,
    borderColor: brandColors.inputBorder,
    backgroundColor: brandColors.inputFill,
    paddingHorizontal: 14,
    ...brandTypography.input,
    color: brandColors.textPrimary
  },
  resetButton: {
    alignSelf: 'flex-start',
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.sage,
    paddingHorizontal: 14,
    paddingVertical: 10
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
    gap: 12,
    borderRadius: brandRadius.card,
    borderWidth: 1,
    borderColor: brandColors.divider,
    backgroundColor: brandColors.white,
    padding: 14,
    ...brandShadow.card
  },
  surveyCardSelected: {
    borderColor: brandColors.forest,
    backgroundColor: '#F9FBF4'
  },
  surveyCardMedia: {
    width: 86,
    height: 104
  },
  surveyCardPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: brandColors.panelMuted
  },
  surveyCardPreviewPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brandColors.panelMuted
  },
  surveyCardContent: {
    flex: 1,
    gap: 8
  },
  surveyCardHeader: {
    gap: 2
  },
  surveyCardTitle: {
    ...brandTypography.input,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: brandColors.textPrimary
  },
  surveyCardDate: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  surveyCardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  inlineMetaText: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  surveyCardSupport: {
    ...brandTypography.meta,
    color: brandColors.textSecondary
  },
  surveyCardSupportWarning: {
    color: brandColors.terracotta
  },
  progressBlock: {
    gap: 6
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
    height: 10,
    borderRadius: brandRadius.pill,
    backgroundColor: '#DFE5D7',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: brandRadius.pill,
    backgroundColor: brandColors.moss
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  badge: {
    borderRadius: brandRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6
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
