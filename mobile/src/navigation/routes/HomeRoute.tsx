import { memo } from "react"
import { HomeScreen } from "../../screens/HomeScreen"
import { useNearbyParcelsState } from "../../state/nearby-parcels-context"
import { useSession } from "../../state/session-context"
import { useSurveys } from "../../state/surveys-context"
import { useSyncActions } from "../../state/sync-actions-context"
import { useLatestCallback } from "../../state/useLatestCallback"
import type { HomeRouteProps } from "../types"

/**
 * Home route (phase 01.9-18, D-01): the signed-in user, the local surveys and
 * the nearby parcels. No status or form value reaches it.
 */
export const HomeRoute = memo(function HomeRoute({ navigation }: HomeRouteProps) {
  const { state: session } = useSession()
  const { state: surveys, actions } = useSurveys()
  const nearbyParcels = useNearbyParcelsState()
  const syncActions = useSyncActions()

  const onCreateSurvey = useLatestCallback(() => {
    actions.openCreateSurvey()
    navigation.navigate("surveys", { screen: "surveyForm" })
  })
  const onOpenSurvey = useLatestCallback((surveyId: string) => {
    actions.openSurvey(surveyId)
    navigation.navigate("surveys", { screen: "surveyDetail" })
  })
  const onNavigateToExplorer = useLatestCallback(() => {
    navigation.navigate("publicMap")
  })

  return (
    <HomeScreen
      currentUser={session.currentUser}
      surveys={surveys.surveys}
      surveyStats={surveys.surveyStats}
      nearbyParcels={nearbyParcels.state}
      onLoadNearbyParcels={nearbyParcels.load}
      onCreateSurvey={onCreateSurvey}
      onOpenSurvey={onOpenSurvey}
      onNavigateToExplorer={onNavigateToExplorer}
      onRefresh={syncActions.handlePullChanges}
    />
  )
})
