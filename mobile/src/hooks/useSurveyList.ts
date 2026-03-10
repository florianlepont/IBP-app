import { useMemo, useState } from 'react';
import {
  buildAttachmentCountBySurvey,
  buildAttachmentsBySurvey,
  computeSurveyStats,
  filterAndSortSurveys
} from '../app/survey-logic';
import {
  SurveyAttachmentFilter,
  SurveyBlockedFilter,
  SurveySort,
  SurveyStatusFilter,
  SurveyVisibilityFilter,
  SurveySyncFilter
} from '../app/types';
import { listLocalAttachments, listLocalSurveys, LocalAttachment, LocalSurvey } from '../storage';

export function useSurveyList() {
  const [surveys, setSurveys] = useState<LocalSurvey[]>([]);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [surveyQuery, setSurveyQuery] = useState('');
  const [surveyFromDate, setSurveyFromDate] = useState('');
  const [surveyToDate, setSurveyToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<SurveyStatusFilter>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<SurveyVisibilityFilter>('all');
  const [syncFilter, setSyncFilter] = useState<SurveySyncFilter>('all');
  const [blockedFilter, setBlockedFilter] = useState<SurveyBlockedFilter>('all');
  const [attachmentFilter, setAttachmentFilter] = useState<SurveyAttachmentFilter>('all');
  const [sortMode, setSortMode] = useState<SurveySort>('updated_desc');

  const refreshLocalSurveys = async (): Promise<void> => {
    const rows = await listLocalSurveys();
    setSurveys(rows);
  };

  const refreshLocalAttachments = async (): Promise<void> => {
    const rows = await listLocalAttachments();
    setAttachments(rows);
  };

  const attachmentsBySurvey = useMemo(() => buildAttachmentsBySurvey(attachments), [attachments]);
  const attachmentCountBySurvey = useMemo(() => buildAttachmentCountBySurvey(attachments), [attachments]);

  const surveyStats = useMemo(() => computeSurveyStats(surveys), [surveys]);

  const visibleSurveys = useMemo(
    () =>
      filterAndSortSurveys(
        surveys,
        { surveyQuery, surveyFromDate, surveyToDate, statusFilter, visibilityFilter, syncFilter, blockedFilter, attachmentFilter, sortMode },
        attachmentCountBySurvey
      ),
    [
      surveys,
      surveyQuery,
      surveyFromDate,
      surveyToDate,
      statusFilter,
      visibilityFilter,
      syncFilter,
      blockedFilter,
      attachmentFilter,
      sortMode,
      attachmentCountBySurvey
    ]
  );

  const selectedSurvey = useMemo(
    () => (selectedSurveyId ? surveys.find((survey) => survey.id === selectedSurveyId) ?? null : null),
    [surveys, selectedSurveyId]
  );

  const selectedSurveyAttachments = useMemo(
    () => (selectedSurvey ? attachmentsBySurvey[selectedSurvey.id] ?? [] : []),
    [selectedSurvey, attachmentsBySurvey]
  );

  const resetFilters = (): void => {
    setSurveyQuery('');
    setSurveyFromDate('');
    setSurveyToDate('');
    setStatusFilter('all');
    setVisibilityFilter('all');
    setSyncFilter('all');
    setBlockedFilter('all');
    setAttachmentFilter('all');
    setSortMode('updated_desc');
  };

  const openSurvey = (surveyId: string): void => {
    setSelectedSurveyId(surveyId);
  };

  const closeSurvey = (): void => {
    setSelectedSurveyId(null);
  };

  return {
    surveys,
    attachments,
    selectedSurveyId,
    selectedSurvey,
    selectedSurveyAttachments,
    surveyStats,
    visibleSurveys,
    attachmentsBySurvey,
    attachmentCountBySurvey,
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
    refreshLocalSurveys,
    refreshLocalAttachments,
    setSelectedSurveyId,
    openSurvey,
    closeSurvey
  };
}
