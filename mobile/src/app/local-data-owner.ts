/**
 * Pure decision logic for D-04 ("local data owned by another account").
 *
 * No storage or React dependency here on purpose — mobile/src/storage/local-owner.ts
 * persists the owner marker and counts unsynced work; mobile/src/hooks/useLocalDataOwner.ts
 * wires this decision table into the app.
 */

export type UnsyncedLocalWork = {
  surveys: number
  attachments: number
}

export type LocalOwnershipDecision =
  | "adopt"
  | "match"
  | "purge-and-adopt"
  | "conflict"
  | "unknown-session"

export function hasUnsyncedWork(work: UnsyncedLocalWork): boolean {
  return work.surveys > 0 || work.attachments > 0
}

export function resolveLocalDataOwnership(input: {
  storedOwnerSub: string | null
  sessionSub: string | null
  unsynced: UnsyncedLocalWork
}): LocalOwnershipDecision {
  const { storedOwnerSub, sessionSub, unsynced } = input

  if (!sessionSub) {
    return "unknown-session"
  }

  if (!storedOwnerSub) {
    return "adopt"
  }

  if (storedOwnerSub === sessionSub) {
    return "match"
  }

  return hasUnsyncedWork(unsynced) ? "conflict" : "purge-and-adopt"
}

export function formatUnsyncedWorkSummary(work: UnsyncedLocalWork): string {
  const parts: string[] = []

  if (work.surveys > 0) {
    parts.push(work.surveys === 1 ? "1 relevé" : `${work.surveys} relevés`)
  }

  if (work.attachments > 0) {
    parts.push(work.attachments === 1 ? "1 photo" : `${work.attachments} photos`)
  }

  if (parts.length === 0) {
    return "aucune donnée"
  }

  return parts.join(" et ")
}
