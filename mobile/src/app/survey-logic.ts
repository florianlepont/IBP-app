import { LocalAttachment, LocalSurvey } from "../storage"
import { SubmitBlockReason, SurveyListFilters, SurveyStats } from "./types"

const parseDate = (value: string): number => {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

const parseDateFilterBoundary = (value: string, boundary: "start" | "end"): number | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z"
  const timestamp = Date.parse(`${trimmed}${suffix}`)
  return Number.isFinite(timestamp) ? timestamp : null
}

export const buildAttachmentCountBySurvey = (
  attachments: LocalAttachment[],
): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const attachment of attachments) {
    counts[attachment.survey_id] = (counts[attachment.survey_id] ?? 0) + 1
  }
  return counts
}

export const buildAttachmentsBySurvey = (
  attachments: LocalAttachment[],
): Record<string, LocalAttachment[]> => {
  const grouped: Record<string, LocalAttachment[]> = {}
  for (const attachment of attachments) {
    if (!grouped[attachment.survey_id]) {
      grouped[attachment.survey_id] = []
    }
    grouped[attachment.survey_id].push(attachment)
  }
  return grouped
}

export const computeSurveyStats = (surveys: LocalSurvey[]): SurveyStats => {
  let draft = 0
  let submitted = 0
  let pending = 0
  let synced = 0
  let failed = 0
  let blocked = 0

  for (const survey of surveys) {
    if (survey.status === "submitted") submitted += 1
    if (survey.status === "draft") draft += 1
    if (survey.sync_state === "pending") pending += 1
    if (survey.sync_state === "synced") synced += 1
    if (survey.sync_state === "failed") failed += 1
    if (survey.sync_blocked === 1) blocked += 1
  }

  return {
    total: surveys.length,
    draft,
    submitted,
    pending,
    synced,
    failed,
    blocked,
  }
}

export const resolveEffectiveSurveyStatus = (survey: LocalSurvey): LocalSurvey["status"] => {
  if (survey.status === "submitted" || survey.status === "expired") {
    return survey.status
  }
  if (survey.sync_state === "failed") {
    return "error"
  }
  if (survey.sync_state === "synced") {
    return "synced"
  }
  return survey.status
}

export type SurveyUiStatus =
  | "draft"
  | "sync_pending"
  | "sync_error"
  | "sync_blocked"
  | "submitted"
  | "expired"

export const resolveSurveyUiStatus = (survey: LocalSurvey): SurveyUiStatus => {
  if (survey.status === "submitted") return "submitted"
  if (survey.status === "expired") return "expired"
  if (survey.sync_state === "failed") {
    return survey.sync_blocked === 1 ? "sync_blocked" : "sync_error"
  }
  if (survey.sync_state === "pending") return "sync_pending"
  return "draft"
}

export const formatSurveyUiStatusLabel = (uiStatus: SurveyUiStatus): string => {
  if (uiStatus === "submitted") return "Submitted"
  if (uiStatus === "expired") return "Expired"
  if (uiStatus === "sync_pending") return "Sync pending"
  if (uiStatus === "sync_error") return "Sync error"
  if (uiStatus === "sync_blocked") return "Sync blocked"
  return "Draft"
}

export type SurveyWorkflowStatus = "draft" | "pending" | "submitted" | "expired"

export const resolveSurveyWorkflowStatus = (survey: LocalSurvey): SurveyWorkflowStatus => {
  if (survey.status === "submitted") return "submitted"
  if (survey.status === "expired") return "expired"
  if (survey.sync_state === "pending") return "pending"
  return "draft"
}

export const formatSurveyWorkflowStatusLabel = (status: SurveyWorkflowStatus): string => {
  if (status === "submitted") return "Submitted"
  if (status === "expired") return "Expired"
  if (status === "pending") return "Pending"
  return "Draft"
}

export type SurveySyncDisplay = "local" | "sync" | "sync_error" | "sync_blocked"

export const resolveSurveySyncDisplay = (survey: LocalSurvey): SurveySyncDisplay => {
  if (survey.sync_state === "failed") {
    return survey.sync_blocked === 1 ? "sync_blocked" : "sync_error"
  }
  if (survey.status === "submitted" && survey.sync_state === "synced") {
    return "sync"
  }
  return "local"
}

export const formatSurveySyncDisplayLabel = (syncDisplay: SurveySyncDisplay): string => {
  if (syncDisplay === "sync") return "Sync"
  if (syncDisplay === "sync_error") return "Sync error"
  if (syncDisplay === "sync_blocked") return "Sync blocked"
  return "Local"
}

export const filterAndSortSurveys = (
  surveys: LocalSurvey[],
  filters: SurveyListFilters,
  attachmentCountBySurvey: Record<string, number>,
): LocalSurvey[] => {
  const query = filters.surveyQuery.trim().toLowerCase()
  const fromBoundary = parseDateFilterBoundary(filters.surveyFromDate, "start")
  const toBoundary = parseDateFilterBoundary(filters.surveyToDate, "end")

  const filtered = surveys.filter((survey) => {
    const lifecycleStatus: "draft" | "submitted" | "expired" =
      survey.status === "submitted"
        ? "submitted"
        : survey.status === "expired"
          ? "expired"
          : "draft"
    const updatedAtTs = parseDate(survey.updated_at)
    if (fromBoundary !== null && updatedAtTs < fromBoundary) return false
    if (toBoundary !== null && updatedAtTs > toBoundary) return false

    if (filters.statusFilter !== "all" && lifecycleStatus !== filters.statusFilter) {
      return false
    }
    if (filters.visibilityFilter !== "all" && survey.visibility !== filters.visibilityFilter)
      return false
    if (filters.syncFilter !== "all" && survey.sync_state !== filters.syncFilter) return false

    const isBlocked = survey.sync_blocked === 1
    if (filters.blockedFilter === "blocked" && !isBlocked) return false
    if (filters.blockedFilter === "unblocked" && isBlocked) return false

    const attachmentCount = attachmentCountBySurvey[survey.id] ?? 0
    if (filters.attachmentFilter === "with" && attachmentCount === 0) return false
    if (filters.attachmentFilter === "without" && attachmentCount > 0) return false

    if (query.length > 0) {
      const haystack =
        `${survey.site_name} ${survey.id} ${survey.last_sync_error ?? ""}`.toLowerCase()
      if (!haystack.includes(query)) return false
    }

    return true
  })

  const sorted = [...filtered]
  if (filters.sortMode === "site_asc") {
    sorted.sort((a, b) => a.site_name.localeCompare(b.site_name))
    return sorted
  }

  if (filters.sortMode === "updated_asc") {
    sorted.sort((a, b) => parseDate(a.updated_at) - parseDate(b.updated_at))
    return sorted
  }

  sorted.sort((a, b) => parseDate(b.updated_at) - parseDate(a.updated_at))
  return sorted
}

export const getSubmitBlockReason = (
  surveyId: string,
  surveys: LocalSurvey[],
): SubmitBlockReason => {
  const target = surveys.find((survey) => survey.id === surveyId)
  if (!target) return "not_found"

  const otherBlockedSurvey = surveys.find(
    (survey) => survey.id !== surveyId && survey.sync_blocked === 1,
  )
  if (otherBlockedSurvey) return "global_blocked"

  if (target.status === "submitted") return "already_submitted"
  if (target.sync_state !== "synced") return "not_synced"
  if (target.sync_blocked === 1) return "survey_blocked"

  return null
}
