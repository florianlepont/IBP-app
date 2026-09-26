import { shouldShowDevTools } from "../app/dev-tools"

declare const statusBrand: unique symbol

// A status line text built only by catalogue functions (D-06). The brand keeps
// raw strings (ids, error text) from being passed where a StatusMessage is due.
export type StatusMessage = string & { readonly [statusBrand]: true }

// Brands catalogue text as a StatusMessage. Call it only inside src/i18n/.
export function statusText(text: string): StatusMessage {
  return text as StatusMessage
}

// Raw technical detail (error text, ids) never reaches the status line; it goes
// to the debug console, and only in builds that show the dev tools.
export function logStatusDetail(context: string, detail: unknown): void {
  if (!shouldShowDevTools()) return
  console.debug(`[status] ${context}`, detail)
}
