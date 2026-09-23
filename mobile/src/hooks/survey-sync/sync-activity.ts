/**
 * Tracks every in-flight call that sends the local queue or writes server data
 * into SQLite (syncPending / pullRemoteChanges), so a local-data purge can
 * stop new ones and wait for the running ones first (WR-08).
 *
 * Without it, a sync started before logout keeps its captured token and can
 * insert the previous account's surveys after `clearLocalIbpData()`. Those rows
 * then carry no owner marker, so the next account would adopt them.
 */

export const SYNC_SUSPENDED_ERROR = "SYNC_SUSPENDED"

export type SyncActivity = {
  /** Runs a sync task; throws SYNC_SUSPENDED while a purge is in progress. */
  run: <T>(task: () => Promise<T>) => Promise<T>
  /** Blocks new sync tasks until the returned `resume` is called. */
  suspend: () => () => void
  /** Resolves once no sync task is running (including tasks started meanwhile). */
  waitForIdle: () => Promise<void>
}

export function createSyncActivity(): SyncActivity {
  const inFlight = new Set<Promise<unknown>>()
  let suspensions = 0

  const run = <T>(task: () => Promise<T>): Promise<T> => {
    if (suspensions > 0) {
      return Promise.reject(new Error(SYNC_SUSPENDED_ERROR))
    }
    const promise = task()
    inFlight.add(promise)
    const settle = (): void => {
      inFlight.delete(promise)
    }
    promise.then(settle, settle)
    return promise
  }

  const suspend = (): (() => void) => {
    suspensions += 1
    let resumed = false
    return () => {
      if (!resumed) {
        resumed = true
        suspensions -= 1
      }
    }
  }

  const waitForIdle = async (): Promise<void> => {
    while (inFlight.size > 0) {
      await Promise.allSettled(Array.from(inFlight))
    }
  }

  return { run, suspend, waitForIdle }
}

export function isSyncSuspendedError(error: unknown): boolean {
  return error instanceof Error && error.message === SYNC_SUSPENDED_ERROR
}

/**
 * Suspends sync, waits for in-flight tasks, runs `purge`, then resumes. The
 * purge therefore always runs after the last write of any earlier sync.
 */
export async function purgeWhileSyncSuspended<T>(
  syncActivity: SyncActivity,
  purge: () => Promise<T>,
): Promise<T> {
  const resume = syncActivity.suspend()
  try {
    await syncActivity.waitForIdle()
    return await purge()
  } finally {
    resume()
  }
}
