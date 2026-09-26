import { createContext, useContext } from "react"
import type { useSurveySyncNetwork } from "../hooks/survey-sync/useSurveySyncNetwork"
import type { useAttachmentPreviews } from "../hooks/survey-sync/useAttachmentPreviews"

type NetworkOperations = ReturnType<typeof useSurveySyncNetwork>
type AttachmentPreviews = ReturnType<typeof useAttachmentPreviews>

/**
 * Sync-actions context (phase 01.9, D-01). The value is built once and never
 * changes identity: every member forwards to the latest implementation
 * (useStableActions), so reading it never causes a re-render.
 */
export type SyncActions = {
  setStatus: (message: string) => void
  handleSync: NetworkOperations["handleSync"]
  handlePullChanges: NetworkOperations["handlePullChanges"]
  handleReportSurvey: NetworkOperations["handleReportSurvey"]
  handleDebugResetIbpData: () => Promise<void>
  handleDebugResetUserData: () => Promise<void>
  handleEnsureAttachmentPreviews: AttachmentPreviews["handleEnsureAttachmentPreviews"]
  handleSimulateMissingAttachmentFile: AttachmentPreviews["handleSimulateMissingAttachmentFile"]
  refreshLocalSurveys: () => Promise<void>
  refreshLocalAttachments: () => Promise<void>
}

export const SyncActionsContext = createContext<SyncActions | null>(null)

export const SyncActionsProvider = SyncActionsContext.Provider

export function useSyncActions(): SyncActions {
  const value = useContext(SyncActionsContext)
  if (value === null) {
    throw new Error("useSyncActions must be used inside AppStateProvider")
  }
  return value
}
