import { memo } from "react"
import { SurveyParcelSelectionScreen } from "../../screens/SurveyParcelSelectionScreen"
import { useSession } from "../../state/session-context"
import { useSurveyFormState } from "../../state/survey-form-context"
import { useLatestCallback } from "../../state/useLatestCallback"
import type { ParcelSelectionRouteProps } from "../types"

/** Parcel selection route (phase 01.9-18, D-01): the form context and the API URL. */
export const ParcelSelectionRoute = memo(function ParcelSelectionRoute({
  navigation,
  route,
}: ParcelSelectionRouteProps) {
  const { state: session } = useSession()
  const { state, actions } = useSurveyFormState()

  const onSave = useLatestCallback(async () => {
    const saved = await actions.saveSurveyEdits()
    if (saved) navigation.goBack()
  })

  return (
    <SurveyParcelSelectionScreen
      apiUrl={session.apiUrl}
      gpsLocation={state.gpsLocation}
      selectedParcelIds={state.selectedParcelIds}
      onToggleParcelSelection={actions.toggleParcelSelection}
      onCaptureGpsLocation={actions.captureGpsLocation}
      hideDoneAction={route.params.mode === "wizard"}
      onSave={onSave}
    />
  )
})
