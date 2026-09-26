import { createContext, useContext } from "react"
import type { StatusMessage } from "../i18n"

/**
 * Status context (phase 01.9, D-01): the last status message. It is the only
 * value that changes when a status is reported, so a status update re-renders
 * only its readers. The stable setter lives in the sync-actions context.
 */
export type StatusContextValue = {
  status: StatusMessage
}

export const StatusContext = createContext<StatusContextValue | null>(null)

export const StatusProvider = StatusContext.Provider

export function useStatus(): StatusContextValue {
  const value = useContext(StatusContext)
  if (value === null) {
    throw new Error("useStatus must be used inside AppStateProvider")
  }
  return value
}
