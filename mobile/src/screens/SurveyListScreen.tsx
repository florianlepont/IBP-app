import { Button, Pressable, Text, TextInput, View } from 'react-native';
import { ReactNode } from 'react';
import { styles } from '../app/styles';
import { formatDateTime, isLessThan24HoursRemaining, resolveSubmissionDeadline } from '../app/formatters';
import {
  SurveyAttachmentFilter,
  SurveyBlockedFilter,
  SurveySort,
  SurveyStats,
  SurveyStatusFilter,
  SurveyVisibilityFilter,
  SurveySyncFilter
} from '../app/types';
import { FilterChip } from '../components/FilterChip';
import { SurveyBadges } from '../components/SurveyBadges';
import { LocalSurvey } from '../storage';

type SurveyListScreenProps = {
  surveys: LocalSurvey[];
  visibleSurveys: LocalSurvey[];
  selectedSurveyId: string | null;
  surveyStats: SurveyStats;
  attachmentCountBySurvey: Record<string, number>;
  surveyQuery: string;
  setSurveyQuery: (value: string) => void;
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
  detailContent: ReactNode;
};

export function SurveyListScreen({
  surveys,
  visibleSurveys,
  selectedSurveyId,
  surveyStats,
  attachmentCountBySurvey,
  surveyQuery,
  setSurveyQuery,
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
  onOpenSurvey,
  detailContent
}: SurveyListScreenProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        Local Surveys ({visibleSurveys.length}/{surveys.length})
      </Text>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryItem}>draft: {surveyStats.draft}</Text>
        <Text style={styles.summaryItem}>submitted: {surveyStats.submitted}</Text>
        <Text style={styles.summaryItem}>pending: {surveyStats.pending}</Text>
        <Text style={styles.summaryItem}>synced: {surveyStats.synced}</Text>
        <Text style={styles.summaryItem}>failed: {surveyStats.failed}</Text>
        <Text style={styles.summaryItem}>blocked: {surveyStats.blocked}</Text>
      </View>

      <Text style={styles.label}>Search surveys</Text>
      <TextInput
        style={styles.input}
        value={surveyQuery}
        onChangeText={setSurveyQuery}
        placeholder="Search by site, id, or last error"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Status</Text>
        <View style={styles.filterChipsRow}>
          <FilterChip label="All" active={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
          <FilterChip label="Draft" active={statusFilter === 'draft'} onPress={() => setStatusFilter('draft')} />
          <FilterChip label="Submitted" active={statusFilter === 'submitted'} onPress={() => setStatusFilter('submitted')} />
          <FilterChip label="Expired" active={statusFilter === 'expired'} onPress={() => setStatusFilter('expired')} />
          <FilterChip label="Synced" active={statusFilter === 'synced'} onPress={() => setStatusFilter('synced')} />
          <FilterChip label="Error" active={statusFilter === 'error'} onPress={() => setStatusFilter('error')} />
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Visibility</Text>
        <View style={styles.filterChipsRow}>
          <FilterChip label="All" active={visibilityFilter === 'all'} onPress={() => setVisibilityFilter('all')} />
          <FilterChip label="Private" active={visibilityFilter === 'private'} onPress={() => setVisibilityFilter('private')} />
          <FilterChip label="Public" active={visibilityFilter === 'public'} onPress={() => setVisibilityFilter('public')} />
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Sync</Text>
        <View style={styles.filterChipsRow}>
          <FilterChip label="All" active={syncFilter === 'all'} onPress={() => setSyncFilter('all')} />
          <FilterChip label="Pending" active={syncFilter === 'pending'} onPress={() => setSyncFilter('pending')} />
          <FilterChip label="Synced" active={syncFilter === 'synced'} onPress={() => setSyncFilter('synced')} />
          <FilterChip label="Failed" active={syncFilter === 'failed'} onPress={() => setSyncFilter('failed')} />
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Blocked</Text>
        <View style={styles.filterChipsRow}>
          <FilterChip label="All" active={blockedFilter === 'all'} onPress={() => setBlockedFilter('all')} />
          <FilterChip label="Blocked only" active={blockedFilter === 'blocked'} onPress={() => setBlockedFilter('blocked')} />
          <FilterChip label="Unblocked" active={blockedFilter === 'unblocked'} onPress={() => setBlockedFilter('unblocked')} />
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Attachments</Text>
        <View style={styles.filterChipsRow}>
          <FilterChip label="All" active={attachmentFilter === 'all'} onPress={() => setAttachmentFilter('all')} />
          <FilterChip label="With photo" active={attachmentFilter === 'with'} onPress={() => setAttachmentFilter('with')} />
          <FilterChip label="Without photo" active={attachmentFilter === 'without'} onPress={() => setAttachmentFilter('without')} />
        </View>
      </View>

      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Sort</Text>
        <View style={styles.filterChipsRow}>
          <FilterChip label="Updated (newest)" active={sortMode === 'updated_desc'} onPress={() => setSortMode('updated_desc')} />
          <FilterChip label="Updated (oldest)" active={sortMode === 'updated_asc'} onPress={() => setSortMode('updated_asc')} />
          <FilterChip label="Site A-Z" active={sortMode === 'site_asc'} onPress={() => setSortMode('site_asc')} />
        </View>
      </View>

      <Pressable onPress={resetFilters} style={styles.filterReset}>
        <Text style={styles.filterResetText}>Reset filters</Text>
      </Pressable>

      {detailContent}

      {visibleSurveys.map((survey) => {
        const attachmentCount = attachmentCountBySurvey[survey.id] ?? 0;
        const submissionDeadline = resolveSubmissionDeadline(survey.created_at, null);
        const showExpirationWarning = survey.status === 'draft' && isLessThan24HoursRemaining(submissionDeadline);
        return (
          <View key={survey.id} style={styles.row}>
            <Text style={styles.rowTitle}>{survey.site_name}</Text>
            <Text style={styles.rowMeta}>id: {survey.id}</Text>
            <Text style={styles.rowMeta}>created: {formatDateTime(survey.created_at)}</Text>
            <Text style={styles.rowMeta}>updated: {survey.updated_at}</Text>
            <Text style={styles.rowMeta}>completion: {survey.completion_rate}%</Text>
            {showExpirationWarning ? <Text style={styles.warningText}>Less than 24h before expiration.</Text> : null}
            <SurveyBadges survey={survey} attachmentCount={attachmentCount} />
            {selectedSurveyId === survey.id ? <Text style={styles.editingTag}>selected in detail panel</Text> : null}
            <View style={styles.miniSpacer} />
            <Button title="Open survey" onPress={() => onOpenSurvey(survey.id)} />
          </View>
        );
      })}

      {surveys.length === 0 ? <Text style={styles.meta}>No local survey yet.</Text> : null}
      {surveys.length > 0 && visibleSurveys.length === 0 ? <Text style={styles.meta}>No survey matches current filters.</Text> : null}
    </View>
  );
}
