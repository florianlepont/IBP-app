import { memo, useMemo } from "react"
import { devOnlyHandler } from "../../app/dev-tools"
import type { FactorKey } from "../../app/types"
import { SurveyDetailScreen } from "../../screens/SurveyDetailScreen"
import { useSession } from "../../state/session-context"
import { useSurveys } from "../../state/surveys-context"
import { useSyncActions } from "../../state/sync-actions-context"
import { useLatestCallback } from "../../state/useLatestCallback"
import type { SurveyDetailRouteProps } from "../types"

/**
 * Survey detail route (phase 01.9-18, D-01): the selected survey and its
 * caches from the surveys context, the API URL from the session, and the sync
 * actions. Renders nothing until a survey is selected.
 */
export const SurveyDetailRoute = memo(function SurveyDetailRoute({
  navigation,
}: SurveyDetailRouteProps) {
  const { state: session } = useSession()
  const { state, actions } = useSurveys()
  const syncActions = useSyncActions()

  const onOpenFactor = useLatestCallback(async (surveyId: string, factor: FactorKey) => {
    const loaded = await actions.startEditSurvey(surveyId)
    if (loaded) {
      navigation.navigate("surveyFactorDetail", { factor })
    }
  })
  const onOpenParcels = useLatestCallback(async (surveyId: string) => {
    const loaded = await actions.startEditSurvey(surveyId)
    if (loaded) {
      navigation.navigate("surveyParcels", { surveyId, mode: "edit" })
    }
  })
  const onSimulateMissingAttachmentFile = useMemo(
    () => devOnlyHandler(syncActions.handleSimulateMissingAttachmentFile),
    [syncActions],
  )

  if (!state.selectedSurvey) return null

  return (
    <SurveyDetailScreen
      apiUrl={session.apiUrl}
      selectedSurvey={state.selectedSurvey}
      selectedSurveyAttachments={state.selectedSurveyAttachments}
      surveyDetailTab={state.surveyDetailTab}
      setSurveyDetailTab={actions.setSurveyDetailTab}
      surveyDetails={state.surveyDetails}
      detailsLoadingSurveyId={state.detailsLoadingSurveyId}
      surveyEvents={state.surveyEvents}
      eventsLoadingSurveyId={state.eventsLoadingSurveyId}
      onLoadSurveyEvents={actions.loadSurveyEvents}
      onTakePhoto={actions.queueAttachmentFromCamera}
      onPickPhoto={actions.queueAttachmentFromLibrary}
      onDeleteAttachment={actions.deleteAttachment}
      onDeleteSurvey={actions.confirmDeleteSurvey}
      onSubmitSurvey={actions.submitSurvey}
      onRetrySurvey={actions.retrySurvey}
      onDiscardSurvey={actions.discardSurvey}
      onToggleVisibility={actions.toggleVisibility}
      onOpenFactor={onOpenFactor}
      onRenameSurvey={actions.renameSurvey}
      onUpdateRegionVersion={actions.updateRegionVersion}
      onUpdateVegetationStage={actions.updateVegetationStage}
      onOpenParcels={onOpenParcels}
      onEnsureAttachmentPreviews={syncActions.handleEnsureAttachmentPreviews}
      onSimulateMissingAttachmentFile={onSimulateMissingAttachmentFile}
    />
  )
})
