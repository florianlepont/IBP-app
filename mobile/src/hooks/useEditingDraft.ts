import { useEffect, useRef } from "react"
import { createLocalDraft, getLocalSurveyDraft, updateLocalDraft } from "../storage/surveys"
import { DEFAULT_SURVEY_FORM } from "../app/constants"
import type { FormMode } from "../navigation/types"
import { useSurveyForm } from "./useSurveyForm"
import { useSurveyList } from "./useSurveyList"

type UseEditingDraftParams = {
  editingSurveyId: string | null
  setEditingSurveyId: (id: string | null) => void
  editingSurveyVisibility: "private" | "public"
  setFormMode: (mode: FormMode) => void
  surveyForm: ReturnType<typeof useSurveyForm>
  surveyList: ReturnType<typeof useSurveyList>
  onStatusChange: (msg: string) => void
  onCloseSurveyDetail: () => void
}

type PendingAutosaveRequest = {
  surveyId: string
  input: UseEditingDraftParams["surveyForm"]["draftInput"]
  visibility: "private" | "public"
  signature: string
}

export function useEditingDraft({
  editingSurveyId,
  setEditingSurveyId,
  editingSurveyVisibility,
  setFormMode,
  surveyForm,
  surveyList,
  onStatusChange,
  onCloseSurveyDetail,
}: UseEditingDraftParams) {
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autosaveInFlightRef = useRef(false)
  const autosaveSignatureRef = useRef("")
  const pendingAutosaveRef = useRef<PendingAutosaveRequest | null>(null)
  const editingSurveyIdRef = useRef(editingSurveyId)
  editingSurveyIdRef.current = editingSurveyId
  const createDraftBootstrappingRef = useRef(false)
  const refreshLocalSurveys = surveyList.refreshLocalSurveys
  const refreshLocalAttachments = surveyList.refreshLocalAttachments
  const setSelectedSurveyId = surveyList.setSelectedSurveyId
  const surveys = surveyList.surveys

  // Reassigned every render so it always closes over the latest
  // onStatusChange/refreshLocalSurveys, without retriggering the debounce
  // effect below whenever those identities change.
  const runAutosaveRef = useRef<((request: PendingAutosaveRequest) => Promise<void>) | undefined>(
    undefined,
  )
  runAutosaveRef.current = async (request: PendingAutosaveRequest): Promise<void> => {
    if (autosaveInFlightRef.current) {
      // A save is already writing: keep only the latest request, don't drop it.
      pendingAutosaveRef.current = request
      return
    }
    autosaveInFlightRef.current = true

    try {
      await updateLocalDraft({
        survey_id: request.surveyId,
        ...request.input,
        visibility: request.visibility,
      })
      await refreshLocalSurveys()
      autosaveSignatureRef.current = request.signature
    } catch (error) {
      onStatusChange(`Autosave error: ${(error as Error).message}`)
    } finally {
      autosaveInFlightRef.current = false
      const pending = pendingAutosaveRef.current
      pendingAutosaveRef.current = null
      if (
        pending &&
        pending.signature !== autosaveSignatureRef.current &&
        pending.surveyId === editingSurveyIdRef.current
      ) {
        void runAutosaveRef.current?.(pending)
      }
    }
  }

  useEffect(() => {
    if (!editingSurveyId) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
      pendingAutosaveRef.current = null
      return
    }

    const draftSignature = JSON.stringify(surveyForm.draftInput)
    if (autosaveSignatureRef.current === draftSignature) {
      return
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }

    autosaveTimerRef.current = setTimeout(() => {
      void runAutosaveRef.current?.({
        surveyId: editingSurveyId,
        input: surveyForm.draftInput,
        visibility: editingSurveyVisibility,
        signature: draftSignature,
      })
    }, 900)

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [editingSurveyId, editingSurveyVisibility, surveyForm.draftInput])

  const handleOpenCreateSurvey = (): void => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    pendingAutosaveRef.current = null
    autosaveSignatureRef.current = ""
    setEditingSurveyId(null)
    setFormMode("create")
    onCloseSurveyDetail()
    surveyForm.resetSurveyForm()
    onStatusChange("Create survey view opened. Initializing local draft...")

    if (createDraftBootstrappingRef.current) {
      return
    }
    createDraftBootstrappingRef.current = true

    const initialDraftInput = {
      site_name: "",
      region_version: DEFAULT_SURVEY_FORM.regionVersion,
      vegetation_stage: DEFAULT_SURVEY_FORM.vegetationStage,
      parcel_ids: [],
      factors: {},
    }

    void (async () => {
      try {
        const created = await createLocalDraft(initialDraftInput)
        await refreshLocalSurveys()
        await refreshLocalAttachments()
        autosaveSignatureRef.current = JSON.stringify(initialDraftInput)
        setEditingSurveyId(created.id)
        setSelectedSurveyId(created.id)
        onStatusChange(`Draft ${created.id} initialized.`)
      } catch (error) {
        onStatusChange(`Draft bootstrap error: ${(error as Error).message}`)
      } finally {
        createDraftBootstrappingRef.current = false
      }
    })()
  }

  const handleCreateDraft = async (): Promise<boolean> => {
    try {
      const draftInput = surveyForm.buildDraftInput()
      if (editingSurveyId) {
        const current = surveys.find((survey) => survey.id === editingSurveyId)
        await updateLocalDraft({
          survey_id: editingSurveyId,
          ...draftInput,
          visibility: current?.visibility ?? "private",
        })

        await refreshLocalSurveys()
        await refreshLocalAttachments()
        pendingAutosaveRef.current = null
        autosaveSignatureRef.current = ""
        setEditingSurveyId(null)
        setFormMode("create")
        setSelectedSurveyId(editingSurveyId)
        onStatusChange(`Local IBP draft ${editingSurveyId} saved`)
        return true
      }

      const created = await createLocalDraft(draftInput)
      await refreshLocalSurveys()
      await refreshLocalAttachments()
      setEditingSurveyId(null)
      setFormMode("create")
      setSelectedSurveyId(created.id)
      onStatusChange("Local IBP draft created with raw observations")
      return true
    } catch (error) {
      onStatusChange(`Draft error: ${(error as Error).message}`)
      return false
    }
  }

  const handleStartEditSurvey = async (surveyId: string): Promise<boolean> => {
    const current = surveys.find((survey) => survey.id === surveyId)
    if (current?.status === "submitted") {
      onStatusChange(`Survey ${surveyId} is submitted and read-only`)
      return false
    }

    try {
      const draft = await getLocalSurveyDraft(surveyId)
      if (!draft) {
        onStatusChange(`Survey not found locally: ${surveyId}`)
        return false
      }
      autosaveSignatureRef.current = JSON.stringify({
        site_name: draft.site_name ?? "",
        region_version: draft.region_version ?? "ACA",
        vegetation_stage: draft.vegetation_stage ?? "",
        parcel_ids: Array.isArray(draft.parcel_ids) ? draft.parcel_ids : [],
        factors: draft.factors ?? {},
      })
      surveyForm.applyDraftToForm(draft)
      setEditingSurveyId(surveyId)
      setFormMode("edit")
      setSelectedSurveyId(surveyId)
      onStatusChange(`Editing survey ${surveyId}`)
      return true
    } catch (error) {
      onStatusChange(`Edit load error: ${(error as Error).message}`)
      return false
    }
  }

  const handleSaveSurveyEdits = async (): Promise<boolean> => {
    if (!editingSurveyId) {
      onStatusChange("No survey selected for editing")
      return false
    }

    try {
      const current = surveys.find((survey) => survey.id === editingSurveyId)
      const draftInput = surveyForm.buildDraftInput()
      await updateLocalDraft({
        survey_id: editingSurveyId,
        ...draftInput,
        visibility: current?.visibility ?? "private",
      })

      await refreshLocalSurveys()
      await refreshLocalAttachments()
      pendingAutosaveRef.current = null
      autosaveSignatureRef.current = ""
      setEditingSurveyId(null)
      setFormMode("create")
      onStatusChange(`Local survey ${editingSurveyId} updated and queued for sync`)
      return true
    } catch (error) {
      onStatusChange(`Edit save error: ${(error as Error).message}`)
      return false
    }
  }

  return {
    handleOpenCreateSurvey,
    handleCreateDraft,
    handleStartEditSurvey,
    handleSaveSurveyEdits,
  }
}
