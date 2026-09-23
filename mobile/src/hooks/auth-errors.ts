import { CredentialsManagerError, CredentialsManagerErrorCodes } from "react-native-auth0"

export const AUTH_REQUIRED_ERROR = "AUTH_REQUIRED"
export const AUTH_TEMPORARILY_UNAVAILABLE_ERROR = "AUTH_TEMPORARILY_UNAVAILABLE"

export type CredentialsFailureKind = "session-ended" | "retry-later"

type ClassifyContext = {
  phase: "restore" | "refresh"
  isOnline: boolean
}

/**
 * Classifies a credentials-manager failure per D-01/D-01a.
 *
 * Only three cases end the session: NO_REFRESH_TOKEN, RENEW_FAILED while the
 * device is online, and NO_CREDENTIALS at restore time. Everything else —
 * every other CredentialsManagerError type and every non-CredentialsManagerError
 * (plain errors, timeouts, strings, undefined) — is "retry-later": the session
 * and all local data stay untouched.
 *
 * RENEW_FAILED is treated as "retry-later" while offline because the installed
 * SDK maps iOS's `renewFailed` to RENEW_FAILED with no separate iOS network
 * code — a network failure during refresh on iOS would otherwise surface
 * identically to a genuine refresh-token rejection and incorrectly end the
 * session (D-01a).
 */
export function classifyCredentialsError(
  error: unknown,
  context: ClassifyContext,
): CredentialsFailureKind {
  if (!(error instanceof CredentialsManagerError)) {
    return "retry-later"
  }

  if (error.type === CredentialsManagerErrorCodes.NO_REFRESH_TOKEN) {
    return "session-ended"
  }

  if (error.type === CredentialsManagerErrorCodes.RENEW_FAILED) {
    return context.isOnline ? "session-ended" : "retry-later"
  }

  if (error.type === CredentialsManagerErrorCodes.NO_CREDENTIALS && context.phase === "restore") {
    return "session-ended"
  }

  return "retry-later"
}

export function isAuthRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message === AUTH_REQUIRED_ERROR
}

export function isAuthTemporarilyUnavailableError(error: unknown): boolean {
  return error instanceof Error && error.message === AUTH_TEMPORARILY_UNAVAILABLE_ERROR
}
