/**
 * Module-level single flight for the local sync engine (D-03).
 *
 * Guarantees at most one drain (`syncPending`) or one pull (`pullRemoteChanges`)
 * runs at a time on the phone: concurrent callers of the same kind join the one
 * task already running, and a caller of the other kind waits for the current
 * flight to settle before starting its own (never overlapping). This closes
 * T-01.5-35 (duplicate drains replaying the same rows) without any change to
 * the hooks that already call the exported `syncPending` / `pullRemoteChanges`.
 *
 * No timers, no React — sync.ts owns the single module-level instance and
 * wraps its guarded entry points with `syncFlight.run(kind, task)`.
 */

export type SyncFlightKind = "sync" | "pull"

export type SyncFlight = {
  run: <T>(kind: SyncFlightKind, task: () => Promise<T>) => Promise<T>
}

type ActiveFlight<T = unknown> = {
  kind: SyncFlightKind
  promise: Promise<T>
}

export function createSyncFlight(): SyncFlight {
  let current: ActiveFlight | null = null

  async function run<T>(kind: SyncFlightKind, task: () => Promise<T>): Promise<T> {
    for (;;) {
      const active = current
      if (active) {
        if (active.kind === kind) {
          // Same-kind join: the caller shares the already-running task's
          // eventual result (or rejection) instead of starting a second one.
          return active.promise as Promise<T>
        }
        // Cross-kind serialisation: wait for the other kind to finish, then
        // loop to re-check. Several same-kind waiters queued here collapse
        // into a single fresh flight once the loop resumes (see module doc).
        await active.promise.catch(() => undefined)
        continue
      }

      const promise = task()
      const entry: ActiveFlight<T> = { kind, promise }
      current = entry
      try {
        return await promise
      } finally {
        // Only clear the slot if it is still ours — guards against a
        // (theoretically impossible, but cheap to guard) stale clear.
        if (current === entry) {
          current = null
        }
      }
    }
  }

  return { run }
}
