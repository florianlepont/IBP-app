import { useCallback, useEffect, useRef, useState } from "react"
import { IdTokenClaims } from "../app/id-token"
import { resolveLocalDataOwnership, UnsyncedLocalWork } from "../app/local-data-owner"
import {
  countUnsyncedLocalWork,
  getLocalDataOwner,
  setLocalDataOwner,
} from "../storage/local-owner"
import { clearLocalIbpData } from "../storage/surveys"

export type LocalDataOwnerStatus = "idle" | "checking" | "ok" | "conflict" | "error"

const EMPTY_WORK: UnsyncedLocalWork = { surveys: 0, attachments: 0, deletions: 0 }

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
}) {
  const { sessionOwner, onLocalDataPurged } = params
  const [status, setStatus] = useState<LocalDataOwnerStatus>("idle")
  const [foreignWork, setForeignWork] = useState<UnsyncedLocalWork>(EMPTY_WORK)
  const [foreignOwnerEmail, setForeignOwnerEmail] = useState<string | null>(null)
  // The Auth0 sub the owner check approved. State drives the render-time
  // `syncAllowed`; the ref serves async callers (ensureSyncOwner).
  const [approvedSub, setApprovedSub] = useState<string | null>(null)
  const approvedSubRef = useRef<string | null>(null)
  const sessionOwnerRef = useRef<IdTokenClaims | null>(sessionOwner)
  sessionOwnerRef.current = sessionOwner

  const approve = useCallback((sub: string | null): void => {
    approvedSubRef.current = sub
    setApprovedSub(sub)
  }, [])

  const recheck = useCallback(async () => {
    const currentOwner = sessionOwnerRef.current
    approve(null)
    if (!currentOwner) {
      setStatus("idle")
      return
    }

    const expectedSub = currentOwner.sub
    setStatus("checking")

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
        approve(expectedSub)
        setStatus("ok")
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
          await clearLocalIbpData()
          await setLocalDataOwner(currentOwner)
          await onLocalDataPurged()
          markOk()
          break
        }
        case "conflict": {
          setForeignWork(unsynced)
          setForeignOwnerEmail(storedOwner?.email ?? null)
          setStatus("conflict")
          break
        }
        case "unknown-session": {
          setStatus("idle")
          break
        }
      }
    } catch {
      if (sessionOwnerRef.current?.sub === expectedSub) {
        setStatus("error")
      }
    }
  }, [approve, onLocalDataPurged])

  // Called only after the user explicitly confirms discarding another
  // account's local data (plan 08's confirmation dialog) — it must never run
  // on its own.
  const discardForeignData = useCallback(async () => {
    const currentOwner = sessionOwnerRef.current
    if (!currentOwner) {
      return
    }

    await clearLocalIbpData()
    await setLocalDataOwner(currentOwner)
    await onLocalDataPurged()
    setForeignWork(EMPTY_WORK)
    approve(currentOwner.sub)
    setStatus("ok")
  }, [approve, onLocalDataPurged])

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
    if (!sessionOwner) {
      approve(null)
      setStatus("idle")
      return
    }
    void recheck()
    // Only the sub identifies a new session for this check; recheck already
    // reads the latest sessionOwner via sessionOwnerRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionOwner?.sub, recheck])

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
