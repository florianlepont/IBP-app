import { memo } from "react"
import { SettingsScreen } from "../../screens/SettingsScreen"
import { useSession } from "../../state/session-context"
import { useStatus } from "../../state/status-context"
import { useSyncActions } from "../../state/sync-actions-context"
import type { SettingsRouteProps } from "../types"

/**
 * Settings route (phase 01.9-18, D-01). The only reader of the status context:
 * a status update re-renders this screen and no other.
 */
export const SettingsRoute = memo(function SettingsRoute(_props: SettingsRouteProps) {
  const { status } = useStatus()
  const { state: session, actions: sessionActions } = useSession()
  const syncActions = useSyncActions()

  return (
    <SettingsScreen
      apiUrl={session.apiUrl}
      onApiUrlChange={sessionActions.setApiUrl}
      onSync={syncActions.handleSync}
      onPullChanges={syncActions.handlePullChanges}
      onRefreshLocalList={syncActions.refreshLocalSurveys}
      onRefreshLocalAttachments={syncActions.refreshLocalAttachments}
      onDeleteAccount={sessionActions.handleDeleteAccount}
      onDebugResetIbpData={syncActions.handleDebugResetIbpData}
      onDebugResetUserData={syncActions.handleDebugResetUserData}
      status={status}
    />
  )
})
