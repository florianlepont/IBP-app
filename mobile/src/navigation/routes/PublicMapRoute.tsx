import { memo, useContext, useEffect } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { styles } from "../../app/styles"
import { usePublicMapExplorer } from "../../hooks/usePublicMapExplorer"
import { PublicMapScreen } from "../../screens/PublicMapScreen"
import { useSession } from "../../state/session-context"
import { useSurveys } from "../../state/surveys-context"
import { useSyncActions } from "../../state/sync-actions-context"
import { useLatestCallback } from "../../state/useLatestCallback"
import { PublicMapReloadContext } from "../public-map-reload"
import type { PublicMapRouteProps } from "../types"

/**
 * Public map route (phase 01.9-18, D-01). The map explorer state lives here,
 * not in the navigation tree: the map items, filters and loading flags only
 * re-render this screen. An Explorer tab press reloads the map through the
 * reload signal (see public-map-reload.ts).
 */
export const PublicMapRoute = memo(function PublicMapRoute(_props: PublicMapRouteProps) {
  const insets = useSafeAreaInsets()
  const { state: session } = useSession()
  const { state: surveys } = useSurveys()
  const syncActions = useSyncActions()
  const reloadSignal = useContext(PublicMapReloadContext)

  const explorer = usePublicMapExplorer({
    apiUrl: session.apiUrl,
    onStatusChange: syncActions.setStatus,
  })

  const reload = useLatestCallback(() => {
    void explorer.loadPublicMap()
  })

  useEffect(() => reloadSignal?.subscribe(reload), [reload, reloadSignal])

  return (
    <View style={[styles.tabScreenContainer, { marginTop: -insets.top }]}>
      <PublicMapScreen
        items={explorer.items}
        parcelStatuses={explorer.parcelStatuses}
        ownSurveyIds={surveys.ownSurveyIds}
        loading={explorer.loading}
        parcelsLoading={explorer.parcelsLoading}
        fromDate={explorer.fromDate}
        toDate={explorer.toDate}
        region={explorer.region}
        onChangeFromDate={explorer.setFromDate}
        onChangeToDate={explorer.setToDate}
        onChangeRegion={explorer.setRegion}
        onLoad={explorer.loadPublicMap}
        onLoadParcels={explorer.loadPublicParcels}
        onReportSurvey={syncActions.handleReportSurvey}
      />
    </View>
  )
})
