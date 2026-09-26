import { useCallback, useEffect, useRef, useState } from "react"
import { IdTokenClaims } from "../app/id-token"
import { resolveLocalDataOwnership, UnsyncedLocalWork } from "../app/local-data-owner"
import {
  countUnsyncedLocalWork,
  getLocalDataOwner,
  setLocalDataOwner,
} from "../storage/local-owner"
import { clearLocalIbpData } from "../storage/surveys"
import { purgeWhileSyncSuspended, SyncActivity } from "./survey-sync/sync-activity"

export type LocalDataOwnerStatus = "idle" | "checking" | "ok" | "conflict" | "error"

const EMPTY_WORK: UnsyncedLocalWork = { surveys: 0, attachments: 0, deletions: 0 }

// WR-07: a failed check (e.g. a transient SQLite error) is retried with
// exponential backoff instead of suspending sync for the rest of the session.
const OWNER_CHECK_RETRY_BASE_MS = 2_000
const OWNER_CHECK_RETRY_MAX_MS = 60_000

/**
 * D-04 owner-check state machine. Never calls the API, never shows UI —
 * `syncAllowed` is default-deny: it is true only when the owner check approved
 * exactly the current session's `sub` ("ok" alone is not enough — a session can
 * switch from A to B in one render while the status still says "ok" for A).
 *
 * `ensureSyncOwner` is the execution-time guard: async sync paths call it right
 * before sending/pulling, with the `sub` of the token they are about to use, and
 * it re-reads the stored owner so nothing is ever sent under the wrong account.
 */
export function useLocalDataOwner(params: {
  sessionOwner: IdTokenClaims | null
  onLocalDataPurged: () => Promise<void>
  /** When given, purges wait for in-flight syncs and block new ones (WR-08). */
  syncActivity?: SyncActivity
}) {
  const { sessionOwner, onLocalDataPurged, syncActivity } = params
  // Named setOwnerStatus: this is the owner-check state, not a status line text.
  const [status, setOwnerStatus] = useState<LocalDataOwnerStatus>("idle")
  const [foreignWork, setForeignWork] = useState<UnsyncedLocalWork>(EMPTY_WORK)
  const [foreignOwnerEmail, setForeignOwnerEmail] = useState<string | null>(null)
  // The Auth0 sub the owner check approved. State drives the render-time
  // `syncAllowed`; the ref serves async callers (ensureSyncOwner).
  const [approvedSub, setApprovedSub] = useState<string | null>(null)
  const approvedSubRef = useRef<string | null>(null)
  const sessionOwnerRef = useRef<IdTokenClaims | null>(sessionOwner)
  sessionOwnerRef.current = sessionOwner
  const retryAttemptRef = useRef(0)
  const sessionSub = sessionOwner?.sub ?? null

  const approve = useCallback((sub: string | null): void => {
    approvedSubRef.current = sub
    setApprovedSub(sub)
  }, [])

  // Purge another account's data and adopt it for `owner`, after any sync
  // still writing that account's data has finished.
  const purgeAndAdopt = useCallback(
    async (owner: IdTokenClaims): Promise<void> => {
      const purge = async (): Promise<void> => {
        await clearLocalIbpData()
        await setLocalDataOwner(owner)
      }
      if (syncActivity) {
        await purgeWhileSyncSuspended(syncActivity, purge)
      } else {
        await purge()
      }
    },
    [syncActivity],
  )

  const recheck = useCallback(async () => {
    const currentOwner = sessionOwnerRef.current
    approve(null)
    if (!currentOwner) {
      setOwnerStatus("idle")
      return
    }

    const expectedSub = currentOwner.sub
    setOwnerStatus("checking")

    try {
      const [storedOwner, unsynced] = await Promise.all([
        getLocalDataOwner(),
        countUnsyncedLocalWork(),
      ])

      // sessionOwner changed while this check was in flight; the effect run
      // triggered by that change owns the outcome now, not this stale one.
      if (sessionOwnerRef.current?.sub !== expectedSub) {
        return
      }

      const decision = resolveLocalDataOwnership({
        storedOwnerSub: storedOwner?.sub ?? null,
        sessionSub: currentOwner.sub,
        unsynced,
      })

      // Approve only if the session is still the one this check ran for; a
      // stale approval must never overwrite a newer session's state.
      const markOk = (): void => {
        if (sessionOwnerRef.current?.sub !== expectedSub) {
          return
        }
        retryAttemptRef.current = 0
        approve(expectedSub)
        setOwnerStatus("ok")
      }

      switch (decision) {
        case "adopt": {
          await setLocalDataOwner(currentOwner)
          markOk()
          break
        }
        case "match": {
          if (storedOwner?.email !== currentOwner.email) {
            await setLocalDataOwner(currentOwner)
          }
          markOk()
          break
        }
        case "purge-and-adopt": {
          await purgeAndAdopt(currentOwner)
          await onLocalDataPurged()
          markOk()
          break
        }
        case "conflict": {
          retryAttemptRef.current = 0
          setForeignWork(unsynced)
          setForeignOwnerEmail(storedOwner?.email ?? null)
          setOwnerStatus("conflict")
          break
        }
        case "unknown-session": {
          setOwnerStatus("idle")
          break
        }
      }
    } catch {
      if (sessionOwnerRef.current?.sub === expectedSub) {
        setOwnerStatus("error")
      }
    }
  }, [approve, onLocalDataPurged, purgeAndAdopt])

  // Called only after the user explicitly confirms discarding another
  // account's local data (plan 08's confirmation dialog) — it must never run
  // on its own.
  const discardForeignData = useCallback(async () => {
    const currentOwner = sessionOwnerRef.current
    if (!currentOwner) {
      return
    }

    await purgeAndAdopt(currentOwner)
    await onLocalDataPurged()
    setForeignWork(EMPTY_WORK)
    approve(currentOwner.sub)
    setOwnerStatus("ok")
  }, [approve, onLocalDataPurged, purgeAndAdopt])

  const ensureSyncOwner = useCallback(async (tokenSub: string | null): Promise<boolean> => {
    const owner = sessionOwnerRef.current
    if (!owner || !tokenSub || tokenSub !== owner.sub || approvedSubRef.current !== owner.sub) {
      return false
    }

    let storedOwner: { sub: string } | null
    try {
      storedOwner = await getLocalDataOwner()
    } catch {
      return false
    }

    // Re-validate after the await: the session may have changed meanwhile.
    return (
      storedOwner?.sub === owner.sub &&
      sessionOwnerRef.current?.sub === owner.sub &&
      approvedSubRef.current === owner.sub
    )
  }, [])

  useEffect(() => {
    retryAttemptRef.current = 0
    if (!sessionOwner) {
      approve(null)
      setOwnerStatus("idle")
      return
    }
    void recheck()
    // Only the sub identifies a new session for this check; recheck already
    // reads the latest sessionOwner via sessionOwnerRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionOwner?.sub, recheck])

  useEffect(() => {
    if (status !== "error" || !sessionSub) {
      return
    }
    const attempt = retryAttemptRef.current
    retryAttemptRef.current = attempt + 1
    const delayMs = Math.min(OWNER_CHECK_RETRY_BASE_MS * 2 ** attempt, OWNER_CHECK_RETRY_MAX_MS)
    const timeoutId = setTimeout(() => {
      void recheck()
    }, delayMs)
    return () => {
      clearTimeout(timeoutId)
    }
  }, [status, sessionSub, recheck])

  return {
    status,
    syncAllowed:
      status === "ok" && approvedSub !== null && approvedSub === (sessionOwner?.sub ?? null),
    ensureSyncOwner,
    foreignWork,
    foreignOwnerEmail,
    discardForeignData,
    recheck,
  }
}
