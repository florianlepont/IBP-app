/**
 * D-04 execution-time owner guard.
 *
 * `syncAllowed` (a render-time boolean) is not enough on its own: an async sync
 * path can capture it in a closure and run after the signed-in account has
 * changed. Every path that sends the local queue or pulls server data calls
 * `assertSyncOwner` inside `withAuthRetry`, immediately before `syncPending` /
 * `pullRemoteChanges`, with the `sub` of the token it is about to use.
 */

export const SYNC_OWNER_MISMATCH_ERROR = "SYNC_OWNER_MISMATCH"

/**
 * Resolves true only when the token's `sub`, the current session owner, the
 * `sub` approved by the owner check and the stored local-data owner all agree.
 */
export type EnsureSyncOwner = (tokenSub: string | null) => Promise<boolean>

export async function assertSyncOwner(
  ensureSyncOwner: EnsureSyncOwner,
  tokenSub: string | null | undefined,
): Promise<void> {
  const allowed = await ensureSyncOwner(tokenSub ?? null)
  if (!allowed) {
    throw new Error(SYNC_OWNER_MISMATCH_ERROR)
  }
}

export function isSyncOwnerMismatchError(error: unknown): boolean {
  return error instanceof Error && error.message === SYNC_OWNER_MISMATCH_ERROR
}
