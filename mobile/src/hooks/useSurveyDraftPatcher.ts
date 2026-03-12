import { getLocalSurveyDraft, updateLocalDraft } from '../storage'
import { DEFAULT_SURVEY_FORM, normalizeVegetationStageForRegion } from '../app/constants'
import { RegionVersion, VegetationStage } from '../app/types'
import { useSurveyList } from './useSurveyList'

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

type DirectDraftPatchInput = {
  site_name: string
  region_version: RegionVersion
  vegetation_stage: VegetationStage
  parcel_ids: string[]
  factors: Record<string, unknown>
}

type UseSurveyDraftPatcherParams = {
  surveyList: ReturnType<typeof useSurveyList>
  onStatusChange: (msg: string) => void
}

export function useSurveyDraftPatcher({ surveyList, onStatusChange }: UseSurveyDraftPatcherParams) {
  const patchSurveyDraftDirectly = async (
    surveyId: string,
    mutator: (draft: DirectDraftPatchInput) => DirectDraftPatchInput,
    successMessage: string,
  ): Promise<boolean> => {
    const current = surveyList.surveys.find((survey) => survey.id === surveyId)
    if (current?.status === 'submitted') {
      onStatusChange(`Survey ${surveyId} is submitted and read-only`)
      return false
    }

    try {
      const draft = await getLocalSurveyDraft(surveyId)
      if (!draft) {
        onStatusChange(`Survey not found locally: ${surveyId}`)
        return false
      }

      const baseRegion: RegionVersion = draft.region_version === 'M' ? 'M' : 'ACA'
      const baseStage = normalizeVegetationStageForRegion(
        baseRegion,
        typeof draft.vegetation_stage === 'string' ? draft.vegetation_stage : DEFAULT_SURVEY_FORM.vegetationStage,
      )
      const base: DirectDraftPatchInput = {
        site_name:
          typeof draft.site_name === 'string' && draft.site_name.trim().length > 0
            ? draft.site_name
            : 'Unnamed site',
        region_version: baseRegion,
        vegetation_stage: baseStage,
        parcel_ids: Array.isArray(draft.parcel_ids)
          ? draft.parcel_ids.filter((value): value is string => typeof value === 'string')
          : [],
        factors: asRecord(draft.factors),
      }
      const next = mutator(base)

      await updateLocalDraft({
        survey_id: surveyId,
        site_name: next.site_name,
        region_version: next.region_version,
        vegetation_stage: next.vegetation_stage,
        parcel_ids: next.parcel_ids,
        factors: next.factors,
        visibility: current?.visibility ?? 'private',
      })

      await surveyList.refreshLocalSurveys()
      await surveyList.refreshLocalAttachments()
      onStatusChange(successMessage)
      return true
    } catch (error) {
      onStatusChange(`Direct update error: ${(error as Error).message}`)
      return false
    }
  }

  const handleRenameSurvey = async (surveyId: string, nextSiteName: string): Promise<void> => {
    await patchSurveyDraftDirectly(
      surveyId,
      (draft) => ({ ...draft, site_name: nextSiteName.trim() || 'Unnamed site' }),
      `Survey name updated for ${surveyId}`,
    )
  }

  const handleUpdateSurveyRegionVersion = async (surveyId: string, region: RegionVersion): Promise<void> => {
    await patchSurveyDraftDirectly(
      surveyId,
      (draft) => ({
        ...draft,
        region_version: region,
        vegetation_stage: normalizeVegetationStageForRegion(region, draft.vegetation_stage),
      }),
      `Region updated for ${surveyId}`,
    )
  }

  const handleUpdateSurveyVegetationStage = async (surveyId: string, stage: VegetationStage): Promise<void> => {
    await patchSurveyDraftDirectly(
      surveyId,
      (draft) => ({
        ...draft,
        vegetation_stage: normalizeVegetationStageForRegion(draft.region_version, stage),
      }),
      `Vegetation stage updated for ${surveyId}`,
    )
  }

  return {
    patchSurveyDraftDirectly,
    handleRenameSurvey,
    handleUpdateSurveyRegionVersion,
    handleUpdateSurveyVegetationStage,
  }
}
