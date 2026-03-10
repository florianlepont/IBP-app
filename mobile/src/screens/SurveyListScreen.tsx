import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../app/styles';
import { formatDateTime } from '../app/formatters';
import {
  SurveyAttachmentFilter,
  SurveyBlockedFilter,
  SurveySort,
  SurveyStatusFilter,
  SurveyVisibilityFilter,
  SurveySyncFilter
} from '../app/types';
import { FilterChip } from '../components/FilterChip';
import { LocalAttachment, LocalSurvey } from '../storage';

type SurveyListScreenProps = {
  surveys: LocalSurvey[];
  visibleSurveys: LocalSurvey[];
  selectedSurveyId: string | null;
  attachmentsBySurvey: Record<string, LocalAttachment[]>;
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
};

export function SurveyListScreen({
  surveys,
  visibleSurveys,
  selectedSurveyId,
  attachmentsBySurvey,
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
  onOpenSurvey
}: SurveyListScreenProps) {
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  return (
    <View style={styles.surveyListContainer}>
      <View style={styles.card}>
        <Text style={styles.label}>Search surveys</Text>
        <TextInput
          style={styles.input}
          value={surveyQuery}
          onChangeText={setSurveyQuery}
          placeholder="Search by site, id, or last error"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.filterGroupCompact}>
          <Text style={styles.filterLabelCompact}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsInlineRow}>
            <FilterChip label="All" active={statusFilter === 'all'} onPress={() => setStatusFilter('all')} />
            <FilterChip label="Draft" active={statusFilter === 'draft'} onPress={() => setStatusFilter('draft')} />
            <FilterChip label="Submitted" active={statusFilter === 'submitted'} onPress={() => setStatusFilter('submitted')} />
            <FilterChip label="Expired" active={statusFilter === 'expired'} onPress={() => setStatusFilter('expired')} />
            <FilterChip label="Synced" active={statusFilter === 'synced'} onPress={() => setStatusFilter('synced')} />
            <FilterChip label="Error" active={statusFilter === 'error'} onPress={() => setStatusFilter('error')} />
          </ScrollView>
        </View>

        <View style={styles.filterGroupCompact}>
          <Text style={styles.filterLabelCompact}>Visibility</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsInlineRow}>
            <FilterChip label="All" active={visibilityFilter === 'all'} onPress={() => setVisibilityFilter('all')} />
            <FilterChip label="Private" active={visibilityFilter === 'private'} onPress={() => setVisibilityFilter('private')} />
            <FilterChip label="Public" active={visibilityFilter === 'public'} onPress={() => setVisibilityFilter('public')} />
          </ScrollView>
        </View>
        <View style={styles.filterToolbarRow}>
          <Pressable style={styles.filterIconButton} onPress={() => setAdvancedFiltersOpen((value) => !value)}>
            <Ionicons name="funnel-outline" size={18} color="#2a5b43" />
          </Pressable>
          <Pressable style={styles.filterAdvancedToggle} onPress={() => setAdvancedFiltersOpen((value) => !value)}>
            <Text style={styles.filterAdvancedToggleText}>{advancedFiltersOpen ? 'Hide advanced filters' : 'Advanced filters'}</Text>
          </Pressable>
        </View>

        {advancedFiltersOpen ? (
          <View style={styles.filterAdvancedPanel}>
            <View style={styles.filterGroupCompact}>
              <Text style={styles.filterLabelCompact}>Sync</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsInlineRow}>
                <FilterChip label="All" active={syncFilter === 'all'} onPress={() => setSyncFilter('all')} />
                <FilterChip label="Pending" active={syncFilter === 'pending'} onPress={() => setSyncFilter('pending')} />
                <FilterChip label="Synced" active={syncFilter === 'synced'} onPress={() => setSyncFilter('synced')} />
                <FilterChip label="Failed" active={syncFilter === 'failed'} onPress={() => setSyncFilter('failed')} />
              </ScrollView>
            </View>

            <View style={styles.filterGroupCompact}>
              <Text style={styles.filterLabelCompact}>Blocked</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsInlineRow}>
                <FilterChip label="All" active={blockedFilter === 'all'} onPress={() => setBlockedFilter('all')} />
                <FilterChip label="Blocked only" active={blockedFilter === 'blocked'} onPress={() => setBlockedFilter('blocked')} />
                <FilterChip label="Unblocked" active={blockedFilter === 'unblocked'} onPress={() => setBlockedFilter('unblocked')} />
              </ScrollView>
            </View>

            <View style={styles.filterGroupCompact}>
              <Text style={styles.filterLabelCompact}>Attachments</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsInlineRow}>
                <FilterChip label="All" active={attachmentFilter === 'all'} onPress={() => setAttachmentFilter('all')} />
                <FilterChip label="With photo" active={attachmentFilter === 'with'} onPress={() => setAttachmentFilter('with')} />
                <FilterChip label="Without photo" active={attachmentFilter === 'without'} onPress={() => setAttachmentFilter('without')} />
              </ScrollView>
            </View>

            <View style={styles.filterGroupCompact}>
              <Text style={styles.filterLabelCompact}>Sort</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsInlineRow}>
                <FilterChip label="Updated (newest)" active={sortMode === 'updated_desc'} onPress={() => setSortMode('updated_desc')} />
                <FilterChip label="Updated (oldest)" active={sortMode === 'updated_asc'} onPress={() => setSortMode('updated_asc')} />
                <FilterChip label="Site A-Z" active={sortMode === 'site_asc'} onPress={() => setSortMode('site_asc')} />
              </ScrollView>
            </View>

            <Pressable onPress={resetFilters} style={styles.filterReset}>
              <Text style={styles.filterResetText}>Reset filters</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.surveyListScroll} contentContainerStyle={styles.surveyListScrollContent}>
        {visibleSurveys.map((survey) => {
          const firstAttachmentWithPreview = (attachmentsBySurvey[survey.id] ?? []).find((attachment) =>
            Boolean(attachment.local_uri?.trim())
          );
          const completionRate = Math.max(0, Math.min(100, survey.completion_rate));

          return (
            <Pressable
              key={survey.id}
              style={[styles.surveyListItemCard, selectedSurveyId === survey.id ? styles.surveyListItemCardSelected : null]}
              onPress={() => onOpenSurvey(survey.id)}
            >
              <View style={styles.surveyListItemMedia}>
                {firstAttachmentWithPreview?.local_uri ? (
                  <Image source={{ uri: firstAttachmentWithPreview.local_uri }} style={styles.surveyListItemPreview} />
                ) : (
                  <View style={styles.surveyListItemPreviewPlaceholder}>
                    <Ionicons name="image-outline" size={20} color="#7a8f82" />
                  </View>
                )}
              </View>
              <View style={styles.surveyListItemContent}>
                <Text style={styles.surveyListItemTitle}>{survey.site_name}</Text>
                <Text style={styles.surveyListItemMeta}>Created: {formatDateTime(survey.created_at)}</Text>
                <View style={styles.surveyCompletionRow}>
                  <Text style={styles.surveyCompletionLabel}>{completionRate}% complete</Text>
                  <View style={styles.surveyCompletionTrack}>
                    <View style={[styles.surveyCompletionFill, { width: `${completionRate}%` }]} />
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, survey.status === 'submitted' ? styles.badgeStatusSubmitted : styles.badgeStatusDraft]}>
                    <Text style={styles.badgeText}>status: {survey.status}</Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      survey.sync_state === 'synced'
                        ? styles.badgeSyncSynced
                        : survey.sync_state === 'pending'
                          ? styles.badgeSyncPending
                          : styles.badgeSyncFailed
                    ]}
                  >
                    <Text style={styles.badgeText}>sync: {survey.sync_state}</Text>
                  </View>
                  <View style={[styles.badge, styles.badgeNeutral]}>
                    <Text style={styles.badgeText}>visibility: {survey.visibility}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}

        {surveys.length === 0 ? <Text style={styles.meta}>No local survey yet.</Text> : null}
        {surveys.length > 0 && visibleSurveys.length === 0 ? <Text style={styles.meta}>No survey matches current filters.</Text> : null}
      </ScrollView>
    </View>
  );
}
