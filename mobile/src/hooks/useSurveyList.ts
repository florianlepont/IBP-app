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
  SurveySyncFilter
} from '../app/types';
import { listLocalAttachments, listLocalSurveys, LocalAttachment, LocalSurvey } from '../storage';

export function useSurveyList() {
  const [surveys, setSurveys] = useState<LocalSurvey[]>([]);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  const [surveyQuery, setSurveyQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SurveyStatusFilter>('all');
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
        { surveyQuery, statusFilter, syncFilter, blockedFilter, attachmentFilter, sortMode },
        attachmentCountBySurvey
      ),
    [surveys, surveyQuery, statusFilter, syncFilter, blockedFilter, attachmentFilter, sortMode, attachmentCountBySurvey]
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
    setStatusFilter('all');
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
    statusFilter,
    setStatusFilter,
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
