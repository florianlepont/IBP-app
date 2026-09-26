import { createContext, useContext } from "react"
import type { GpsCaptureResult } from "../app/types"
import type { useSurveyForm } from "../hooks/useSurveyForm"
import type { FormMode } from "../navigation/types"

type SurveyForm = ReturnType<typeof useSurveyForm>

/**
 * Survey form context (phase 01.9, D-01): the fields of the survey being
 * created or edited and the form actions. It is the only value that changes on
 * a form keystroke. The nearby parcels have their own context (01.9-18).
 */
export type SurveyFormState = {
  siteName: SurveyForm["siteName"]
  regionVersion: SurveyForm["regionVersion"]
  vegetationStage: SurveyForm["vegetationStage"]
  gpsLocation: SurveyForm["gpsLocation"]
  selectedParcelIds: SurveyForm["selectedParcelIds"]
  factorSections: SurveyForm["factorSections"]
  factorRetainedScores: SurveyForm["factorRetainedScores"]
  formErrors: SurveyForm["formErrors"]
  draftInput: SurveyForm["draftInput"]
  /** Also in the surveys state; repeated here so the form routes read one context (01.9-18). */
  formMode: FormMode
  editingSurveyId: string | null
}

export type SurveyFormActions = {
  setSiteName: SurveyForm["setSiteName"]
  setVegetationStage: SurveyForm["setVegetationStage"]
  setSelectedParcelIds: SurveyForm["setSelectedParcelIds"]
  toggleParcelSelection: SurveyForm["toggleParcelSelection"]
  applyGpsLocation: SurveyForm["applyGpsLocation"]
  handleRegionChange: SurveyForm["handleRegionChange"]
  applyDraftToForm: SurveyForm["applyDraftToForm"]
  resetSurveyForm: SurveyForm["resetSurveyForm"]
  buildDraftInput: SurveyForm["buildDraftInput"]
  saveSurveyEdits: () => Promise<boolean>
  createDraft: () => Promise<boolean>
  captureGpsLocation: () => Promise<GpsCaptureResult | null>
}

export type SurveyFormContextValue = {
  state: SurveyFormState
  actions: SurveyFormActions
}

export const SurveyFormContext = createContext<SurveyFormContextValue | null>(null)

export const SurveyFormProvider = SurveyFormContext.Provider

export function useSurveyFormState(): SurveyFormContextValue {
  const value = useContext(SurveyFormContext)
  if (value === null) {
    throw new Error("useSurveyFormState must be used inside AppStateProvider")
  }
  return value
}
