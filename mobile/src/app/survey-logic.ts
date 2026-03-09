import { LocalAttachment, LocalSurvey } from '../storage';
import { SubmitBlockReason, SurveyListFilters, SurveyStats } from './types';

const parseDate = (value: string): number => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const buildAttachmentCountBySurvey = (attachments: LocalAttachment[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const attachment of attachments) {
    counts[attachment.survey_id] = (counts[attachment.survey_id] ?? 0) + 1;
  }
  return counts;
};

export const buildAttachmentsBySurvey = (attachments: LocalAttachment[]): Record<string, LocalAttachment[]> => {
  const grouped: Record<string, LocalAttachment[]> = {};
  for (const attachment of attachments) {
    if (!grouped[attachment.survey_id]) {
      grouped[attachment.survey_id] = [];
    }
    grouped[attachment.survey_id].push(attachment);
  }
  return grouped;
};

export const computeSurveyStats = (surveys: LocalSurvey[]): SurveyStats => {
  let draft = 0;
  let submitted = 0;
  let pending = 0;
  let synced = 0;
  let failed = 0;
  let blocked = 0;

  for (const survey of surveys) {
    if (survey.status === 'submitted') submitted += 1;
    if (survey.status === 'draft') draft += 1;
    if (survey.sync_state === 'pending') pending += 1;
    if (survey.sync_state === 'synced') synced += 1;
    if (survey.sync_state === 'failed') failed += 1;
    if (survey.sync_blocked === 1) blocked += 1;
  }

  return {
    total: surveys.length,
    draft,
    submitted,
    pending,
    synced,
    failed,
    blocked
  };
};

export const filterAndSortSurveys = (
  surveys: LocalSurvey[],
  filters: SurveyListFilters,
  attachmentCountBySurvey: Record<string, number>
): LocalSurvey[] => {
  const query = filters.surveyQuery.trim().toLowerCase();

  const filtered = surveys.filter((survey) => {
    if (filters.statusFilter !== 'all') {
      if (filters.statusFilter === 'synced') {
        if (!(survey.status === 'synced' || survey.sync_state === 'synced')) return false;
      } else if (filters.statusFilter === 'error') {
        if (!(survey.status === 'error' || survey.sync_state === 'failed')) return false;
      } else if (survey.status !== filters.statusFilter) {
        return false;
      }
    }
    if (filters.visibilityFilter !== 'all' && survey.visibility !== filters.visibilityFilter) return false;
    if (filters.syncFilter !== 'all' && survey.sync_state !== filters.syncFilter) return false;

    const isBlocked = survey.sync_blocked === 1;
    if (filters.blockedFilter === 'blocked' && !isBlocked) return false;
    if (filters.blockedFilter === 'unblocked' && isBlocked) return false;

    const attachmentCount = attachmentCountBySurvey[survey.id] ?? 0;
    if (filters.attachmentFilter === 'with' && attachmentCount === 0) return false;
    if (filters.attachmentFilter === 'without' && attachmentCount > 0) return false;

    if (query.length > 0) {
      const haystack = `${survey.site_name} ${survey.id} ${survey.last_sync_error ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  const sorted = [...filtered];
  if (filters.sortMode === 'site_asc') {
    sorted.sort((a, b) => a.site_name.localeCompare(b.site_name));
    return sorted;
  }

  if (filters.sortMode === 'updated_asc') {
    sorted.sort((a, b) => parseDate(a.updated_at) - parseDate(b.updated_at));
    return sorted;
  }

  sorted.sort((a, b) => parseDate(b.updated_at) - parseDate(a.updated_at));
  return sorted;
};

export const getSubmitBlockReason = (surveyId: string, surveys: LocalSurvey[]): SubmitBlockReason => {
  const target = surveys.find((survey) => survey.id === surveyId);
  if (!target) return 'not_found';

  const otherBlockedSurvey = surveys.find((survey) => survey.id !== surveyId && survey.sync_blocked === 1);
  if (otherBlockedSurvey) return 'global_blocked';

  if (target.status === 'submitted') return 'already_submitted';
  if (target.sync_state !== 'synced') return 'not_synced';
  if (target.sync_blocked === 1) return 'survey_blocked';

  return null;
};
