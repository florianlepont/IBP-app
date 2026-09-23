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

const EMPTY_WORK: UnsyncedLocalWork = { surveys: 0, attachments: 0 }

/**
 * D-04 owner-check state machine. Never calls the API, never shows UI —
 * `syncAllowed` is default-deny: only the "ok" status permits sync, so a
 * mismatched account can never send local data under the wrong owner.
 */
export function useLocalDataOwner(params: {
  sessionOwner: IdTokenClaims | null
  onLocalDataPurged: () => Promise<void>
}) {
  const { sessionOwner, onLocalDataPurged } = params
  const [status, setStatus] = useState<LocalDataOwnerStatus>("idle")
  const [foreignWork, setForeignWork] = useState<UnsyncedLocalWork>(EMPTY_WORK)
  const [foreignOwnerEmail, setForeignOwnerEmail] = useState<string | null>(null)
  const sessionOwnerRef = useRef<IdTokenClaims | null>(sessionOwner)
  sessionOwnerRef.current = sessionOwner

  const recheck = useCallback(async () => {
    const currentOwner = sessionOwnerRef.current
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

      switch (decision) {
        case "adopt": {
          await setLocalDataOwner(currentOwner)
          setStatus("ok")
          break
        }
        case "match": {
          if (storedOwner?.email !== currentOwner.email) {
            await setLocalDataOwner(currentOwner)
          }
          setStatus("ok")
          break
        }
        case "purge-and-adopt": {
          await clearLocalIbpData()
          await setLocalDataOwner(currentOwner)
          await onLocalDataPurged()
          setStatus("ok")
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
  }, [onLocalDataPurged])

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
    setStatus("ok")
  }, [onLocalDataPurged])

  useEffect(() => {
    if (!sessionOwner) {
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
    syncAllowed: status === "ok",
    foreignWork,
    foreignOwnerEmail,
    discardForeignData,
    recheck,
  }
}
