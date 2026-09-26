import { memo, useLayoutEffect } from "react"
import type { FactorKey } from "../../app/types"
import { fr } from "../../i18n"
import { SurveyFormScreen } from "../../screens/SurveyFormScreen"
import { useSession } from "../../state/session-context"
import { useSurveyFormState } from "../../state/survey-form-context"
import { useLatestCallback } from "../../state/useLatestCallback"
import type { SurveyFormRouteProps } from "../types"

/**
 * Survey form route (phase 01.9-18, D-01): the form context and the API URL.
 * It sets its own header title, so the stack navigator does not read the form
 * mode.
 */
export const SurveyFormRoute = memo(function SurveyFormRoute({ navigation }: SurveyFormRouteProps) {
  const { state: session } = useSession()
  const { state, actions } = useSurveyFormState()
  const isEdit = state.formMode === "edit"

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEdit ? fr.navigation.headers.editSurvey : fr.navigation.headers.newSurvey,
    })
  }, [isEdit, navigation])

  const onOpenFactor = useLatestCallback((factor: FactorKey) => {
    navigation.navigate("surveyFactorDetail", { factor })
  })
  const onOpenParcelFullscreen = useLatestCallback(() => {
    navigation.navigate("surveyParcels", {
      surveyId: state.editingSurveyId ?? "draft",
      mode: "wizard",
    })
  })
  const onSaveSurveyEdits = useLatestCallback(async () => {
    const saved = await actions.saveSurveyEdits()
    if (saved) navigation.goBack()
  })
  const onCreateDraft = useLatestCallback(async () => {
    const created = await actions.createDraft()
    if (created) navigation.goBack()
  })

  return (
    <SurveyFormScreen
      apiUrl={session.apiUrl}
      screen={isEdit ? "edit" : "create"}
      editingSurveyId={state.editingSurveyId}
      siteName={state.siteName}
      setSiteName={actions.setSiteName}
      regionVersion={state.regionVersion}
      vegetationStage={state.vegetationStage}
      setVegetationStage={actions.setVegetationStage}
      onRegionChange={actions.handleRegionChange}
      gpsLocation={state.gpsLocation}
      selectedParcelIds={state.selectedParcelIds}
      onToggleParcelSelection={actions.toggleParcelSelection}
      onCaptureGpsLocation={actions.captureGpsLocation}
      factorSections={state.factorSections}
      factorRetainedScores={state.factorRetainedScores}
      formErrors={state.formErrors}
      onOpenFactor={onOpenFactor}
      onOpenParcelFullscreen={onOpenParcelFullscreen}
      onSaveSurveyEdits={onSaveSurveyEdits}
      onCreateDraft={onCreateDraft}
    />
  )
})
