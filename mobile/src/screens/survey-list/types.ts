import type {
  SurveyAttachmentFilter,
  SurveyBlockedFilter,
  SurveySort,
  SurveyStatusFilter,
  SurveySyncFilter,
  SurveyVisibilityFilter,
} from "../../app/types"
import type { LocalAttachment, LocalSurvey } from "../../storage"

export type SurveyListScreenProps = {
  surveys: LocalSurvey[]
  visibleSurveys: LocalSurvey[]
  selectedSurveyId: string | null
  attachmentsBySurvey: Record<string, LocalAttachment[]>
  surveyQuery: string
  setSurveyQuery: (value: string) => void
  surveyFromDate: string
  setSurveyFromDate: (value: string) => void
  surveyToDate: string
  setSurveyToDate: (value: string) => void
  statusFilter: SurveyStatusFilter
  setStatusFilter: (value: SurveyStatusFilter) => void
  visibilityFilter: SurveyVisibilityFilter
  setVisibilityFilter: (value: SurveyVisibilityFilter) => void
  syncFilter: SurveySyncFilter
  setSyncFilter: (value: SurveySyncFilter) => void
  blockedFilter: SurveyBlockedFilter
  setBlockedFilter: (value: SurveyBlockedFilter) => void
  attachmentFilter: SurveyAttachmentFilter
  setAttachmentFilter: (value: SurveyAttachmentFilter) => void
  sortMode: SurveySort
  setSortMode: (value: SurveySort) => void
  resetFilters: () => void
  /**
   * The native iOS header (with its search bar) is shown above the list, so
   * the screen drops its own hero header (01.9-25, D-08).
   */
  useNativeSearchUI?: boolean
  /** The inline search field (Android and the JS fallback). */
  showInlineSearch?: boolean
  onRefresh?: () => Promise<void>
  onDeleteSurvey: (surveyId: string) => void
  onOpenCreateSurvey: () => void
  onOpenSurvey: (surveyId: string) => void
  onEnsureAttachmentPreviews?: (attachments: LocalAttachment[]) => Promise<void> | void
}
