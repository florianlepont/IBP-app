import { useCallback, useMemo, useState } from "react"
import {
  buildAttachmentCountBySurvey,
  buildAttachmentsBySurvey,
  computeSurveyStats,
  filterAndSortSurveys,
} from "../app/survey-logic"
import {
  SurveyAttachmentFilter,
  SurveyBlockedFilter,
  SurveySort,
  SurveyStatusFilter,
  SurveyVisibilityFilter,
  SurveySyncFilter,
} from "../app/types"
import { listLocalAttachments, listLocalSurveys } from "../storage/surveys"
import type { LocalAttachment, LocalSurvey } from "../storage/types"

function shallowEqualRow<T extends object>(left: T, right: T): boolean {
  if (left === right) return true
  const leftKeys = Object.keys(left) as Array<keyof T>
  if (leftKeys.length !== Object.keys(right).length) return false
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false
    if (!Object.is(left[key], right[key])) return false
  }
  return true
}

/**
 * Structural sharing for list refreshes (phase 01.9-22, B6). SQLite reads return
 * fresh objects, which would defeat the memoised list rows on every refresh.
 * For each next row, keep the previous object with the same id when all its own
 * fields are shallow-equal (Object.is). Returns `prev` itself when nothing
 * changed (same length, same order, every object kept).
 */
export function shareUnchanged<T extends { id: string }>(prev: readonly T[], next: T[]): T[] {
  if (prev.length === 0) return next
  const previousById = new Map<string, T>()
  for (const item of prev) previousById.set(item.id, item)

  let unchanged = prev.length === next.length
  const shared = next.map((item, index) => {
    const previous = previousById.get(item.id)
    const kept = previous !== undefined && shallowEqualRow(previous, item) ? previous : item
    if (kept !== prev[index]) unchanged = false
    return kept
  })
  return unchanged ? (prev as T[]) : shared
}

export function useSurveyList() {
  const [surveys, setSurveys] = useState<LocalSurvey[]>([])
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null)
  const [surveyQuery, setSurveyQuery] = useState("")
  const [surveyFromDate, setSurveyFromDate] = useState("")
  const [surveyToDate, setSurveyToDate] = useState("")
  const [statusFilter, setStatusFilter] = useState<SurveyStatusFilter>("all")
  const [visibilityFilter, setVisibilityFilter] = useState<SurveyVisibilityFilter>("all")
  const [syncFilter, setSyncFilter] = useState<SurveySyncFilter>("all")
  const [blockedFilter, setBlockedFilter] = useState<SurveyBlockedFilter>("all")
  const [attachmentFilter, setAttachmentFilter] = useState<SurveyAttachmentFilter>("all")
  const [sortMode, setSortMode] = useState<SurveySort>("updated_desc")

  const refreshLocalSurveys = useCallback(async (): Promise<void> => {
    const rows = await listLocalSurveys()
    setSurveys((previous) => shareUnchanged(previous, rows))
  }, [])

  const refreshLocalAttachments = useCallback(async (): Promise<void> => {
    const rows = await listLocalAttachments()
    setAttachments(rows)
  }, [])

  const attachmentsBySurvey = useMemo(() => buildAttachmentsBySurvey(attachments), [attachments])
  const attachmentCountBySurvey = useMemo(
    () => buildAttachmentCountBySurvey(attachments),
    [attachments],
  )

  const surveyStats = useMemo(() => computeSurveyStats(surveys), [surveys])

  const visibleSurveys = useMemo(
    () =>
      filterAndSortSurveys(
        surveys,
        {
          surveyQuery,
          surveyFromDate,
          surveyToDate,
          statusFilter,
          visibilityFilter,
          syncFilter,
          blockedFilter,
          attachmentFilter,
          sortMode,
        },
        attachmentCountBySurvey,
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
      attachmentCountBySurvey,
    ],
  )

  const selectedSurvey = useMemo(
    () =>
      selectedSurveyId ? (surveys.find((survey) => survey.id === selectedSurveyId) ?? null) : null,
    [surveys, selectedSurveyId],
  )

  const selectedSurveyAttachments = useMemo(
    () => (selectedSurvey ? (attachmentsBySurvey[selectedSurvey.id] ?? []) : []),
    [selectedSurvey, attachmentsBySurvey],
  )

  const resetFilters = useCallback((): void => {
    setSurveyQuery("")
    setSurveyFromDate("")
    setSurveyToDate("")
    setStatusFilter("all")
    setVisibilityFilter("all")
    setSyncFilter("all")
    setBlockedFilter("all")
    setAttachmentFilter("all")
    setSortMode("updated_desc")
  }, [])

  const openSurvey = useCallback((surveyId: string): void => {
    setSelectedSurveyId(surveyId)
  }, [])

  const closeSurvey = useCallback((): void => {
    setSelectedSurveyId(null)
  }, [])

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
    closeSurvey,
  }
}
