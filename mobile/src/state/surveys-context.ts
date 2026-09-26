import { createContext, useContext } from "react"
import type { FormMode } from "../app/AuthenticatedAppNavigation"
import type {
  RegionVersion,
  SurveyDetailResponse,
  SurveyDetailTab,
  SurveyEventItem,
  SurveyStats,
  VegetationStage,
} from "../app/types"
import type { useSurveyList } from "../hooks/useSurveyList"
import type { useSurveySyncSurveyOperations } from "../hooks/survey-sync/useSurveySyncSurveyOperations"

type SurveyList = ReturnType<typeof useSurveyList>
type SurveyOperations = ReturnType<typeof useSurveySyncSurveyOperations>

/**
 * Surveys context (phase 01.9, D-01): the local survey list, its filters, the
 * selection, the server detail and event caches, and the survey actions. It
 * changes when the list, a filter, the selection or a cache changes, never on
 * a status message or a form keystroke.
 */
export type SurveysState = {
  surveys: SurveyList["surveys"]
  visibleSurveys: SurveyList["visibleSurveys"]
  selectedSurveyId: string | null
  selectedSurvey: SurveyList["selectedSurvey"]
  selectedSurveyAttachments: SurveyList["selectedSurveyAttachments"]
  attachmentsBySurvey: SurveyList["attachmentsBySurvey"]
  surveyQuery: string
  surveyFromDate: string
  surveyToDate: string
  statusFilter: SurveyList["statusFilter"]
  visibilityFilter: SurveyList["visibilityFilter"]
  syncFilter: SurveyList["syncFilter"]
  blockedFilter: SurveyList["blockedFilter"]
  attachmentFilter: SurveyList["attachmentFilter"]
  sortMode: SurveyList["sortMode"]
  surveyDetails: Record<string, SurveyDetailResponse>
  detailsLoadingSurveyId: string | null
  surveyEvents: Record<string, SurveyEventItem[]>
  eventsLoadingSurveyId: string | null
  surveyStats: SurveyStats
  ownSurveyIds: string[]
  surveyDetailTab: SurveyDetailTab
  editingSurveyId: string | null
  formMode: FormMode
}

export type SurveyActions = {
  setSurveyQuery: SurveyList["setSurveyQuery"]
  setSurveyFromDate: SurveyList["setSurveyFromDate"]
  setSurveyToDate: SurveyList["setSurveyToDate"]
  setStatusFilter: SurveyList["setStatusFilter"]
  setVisibilityFilter: SurveyList["setVisibilityFilter"]
  setSyncFilter: SurveyList["setSyncFilter"]
  setBlockedFilter: SurveyList["setBlockedFilter"]
  setAttachmentFilter: SurveyList["setAttachmentFilter"]
  setSortMode: SurveyList["setSortMode"]
  resetFilters: SurveyList["resetFilters"]
  openSurvey: (surveyId: string) => void
  closeSurveyDetailSelection: () => void
  setSurveyDetailTab: (tab: SurveyDetailTab) => void
  submitSurvey: SurveyOperations["handleSubmitSurvey"]
  retrySurvey: SurveyOperations["handleRetrySurvey"]
  discardSurvey: SurveyOperations["handleDiscardSurvey"]
  toggleVisibility: SurveyOperations["handleToggleVisibility"]
  confirmDeleteSurvey: SurveyOperations["confirmDeleteSurvey"]
  queueAttachmentFromLibrary: SurveyOperations["handleQueueAttachmentFromLibrary"]
  queueAttachmentFromCamera: SurveyOperations["handleQueueAttachmentFromCamera"]
  deleteAttachment: SurveyOperations["handleDeleteAttachment"]
  loadCanonicalDetails: (surveyId: string, options?: { silent?: boolean }) => Promise<void>
  loadSurveyEvents: (surveyId: string, options?: { silent?: boolean }) => Promise<void>
  openCreateSurvey: () => void
  startEditSurvey: (surveyId: string) => Promise<boolean>
  renameSurvey: (surveyId: string, nextSiteName: string) => Promise<void>
  updateRegionVersion: (surveyId: string, region: RegionVersion) => Promise<void>
  updateVegetationStage: (surveyId: string, stage: VegetationStage) => Promise<void>
}

export type SurveysContextValue = {
  state: SurveysState
  actions: SurveyActions
}

export const SurveysContext = createContext<SurveysContextValue | null>(null)

export const SurveysProvider = SurveysContext.Provider

export function useSurveys(): SurveysContextValue {
  const value = useContext(SurveysContext)
  if (value === null) {
    throw new Error("useSurveys must be used inside AppStateProvider")
  }
  return value
}
