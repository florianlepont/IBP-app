import type { StatusMessage } from "../i18n"

export type OperationScope =
  | "session"
  | "auth"
  | "profile"
  | "sync"
  | "survey"
  | "attachment"
  | "debug"
export type OperationState = "idle" | "running" | "success" | "error"

// The entry stores the message as plain text; every entry point accepts only
// catalogue StatusMessages (D-06).
export type OperationStatusEntry = {
  state: OperationState
  message: string
  updated_at: string
}

export type OperationStatusMap = Record<OperationScope, OperationStatusEntry>

function initialEntry(message: string): OperationStatusEntry {
  return {
    state: "idle",
    message,
    updated_at: new Date(0).toISOString(),
  }
}

export function createInitialOperationStatus(initialMessage: StatusMessage): OperationStatusMap {
  return {
    session: initialEntry(initialMessage),
    auth: initialEntry(initialMessage),
    profile: initialEntry(initialMessage),
    sync: initialEntry(initialMessage),
    survey: initialEntry(initialMessage),
    attachment: initialEntry(initialMessage),
    debug: initialEntry(initialMessage),
  }
}

export function updateOperationStatus(
  current: OperationStatusMap,
  scope: OperationScope,
  state: OperationState,
  message: StatusMessage,
): OperationStatusMap {
  return {
    ...current,
    [scope]: {
      state,
      message,
      updated_at: new Date().toISOString(),
    },
  }
}
