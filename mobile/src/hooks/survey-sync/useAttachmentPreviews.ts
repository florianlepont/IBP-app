import { useCallback, useRef } from "react"
import {
  ensureAttachmentCached,
  simulateMissingAttachmentFile,
} from "../../storage/attachment-cache"
import type { LocalAttachment } from "../../storage/types"
import { isAuthRequiredError } from "../auth-errors"
import { isSyncSuspendedError, SyncActivity } from "./sync-activity"

// D-11: bounds how many photo downloads run at once so a screen with many
// pulled attachments cannot open dozens of parallel connections.
export const MAX_CONCURRENT_ATTACHMENT_DOWNLOADS = 2

type UseAttachmentPreviewsParams = {
  apiUrl: string
  withAuthRetry: <T>(fn: (token: string, tokenSub: string | null) => Promise<T>) => Promise<T>
  syncActivity: SyncActivity
  syncAllowed: boolean
  refreshLocalAttachments: () => Promise<void>
}

/**
 * Downloads and caches server-pulled attachment previews on demand (D-11).
 *
 * Selection per call: "remote" rows are always candidates (unless a previous
 * call this session already found the server has no bytes for that exact
 * updated_at); "local" rows are checked once per session, so an app that
 * lost a photo file behind the app's back is noticed without a filesystem
 * stat on every render; "missing" and "unavailable" rows are never requested
 * (D-10 — they are surfaced to the user, not retried in a loop).
 */
export function useAttachmentPreviews({
  apiUrl,
  withAuthRetry,
  syncActivity,
  syncAllowed,
  refreshLocalAttachments,
}: UseAttachmentPreviewsParams) {
  const seenLocalIdsRef = useRef<Set<string>>(new Set())
  const unavailableThisSessionRef = useRef<Set<string>>(new Set())
  const inFlightRef = useRef<Set<string>>(new Set())

  const handleEnsureAttachmentPreviews = useCallback(
    async (attachments: LocalAttachment[]): Promise<void> => {
      if (!syncAllowed) {
        return
      }

      const candidates: LocalAttachment[] = []
      for (const attachment of attachments) {
        if (inFlightRef.current.has(attachment.id)) {
          continue
        }
        if (attachment.file_state === "remote") {
          const sessionKey = `${attachment.id}:${attachment.updated_at}`
          if (unavailableThisSessionRef.current.has(sessionKey)) {
            continue
          }
          candidates.push(attachment)
        } else if (attachment.file_state === "local") {
          if (seenLocalIdsRef.current.has(attachment.id)) {
            continue
          }
          candidates.push(attachment)
        }
        // "missing" and "unavailable" rows are never requested.
      }

      if (candidates.length === 0) {
        return
      }

      // Reserve every candidate synchronously, before any await, so a second
      // call made while this one is still running never re-selects the same
      // id even if its download has not started yet (worker queue below).
      for (const attachment of candidates) {
        inFlightRef.current.add(attachment.id)
        if (attachment.file_state === "local") {
          seenLocalIdsRef.current.add(attachment.id)
        }
      }

      let changed = false
      let stopped = false
      let cursor = 0

      const worker = async (): Promise<void> => {
        for (;;) {
          if (stopped) {
            return
          }
          const index = cursor
          cursor += 1
          if (index >= candidates.length) {
            return
          }
          const attachment = candidates[index]
          try {
            const result = await withAuthRetry((token) =>
              syncActivity.run(() => ensureAttachmentCached(apiUrl, token, attachment.id)),
            )
            if (result === "unavailable") {
              unavailableThisSessionRef.current.add(`${attachment.id}:${attachment.updated_at}`)
              changed = true
            } else if (
              result === "missing" ||
              (attachment.file_state === "remote" && result === "ready")
            ) {
              changed = true
            }
          } catch (error) {
            if (isSyncSuspendedError(error) || isAuthRequiredError(error)) {
              stopped = true
              return
            }
            // Any other error: skip this id, the next call will retry it.
          } finally {
            inFlightRef.current.delete(attachment.id)
          }
        }
      }

      const workerCount = Math.min(MAX_CONCURRENT_ATTACHMENT_DOWNLOADS, candidates.length)
      await Promise.all(Array.from({ length: workerCount }, () => worker()))

      if (changed) {
        await refreshLocalAttachments()
      }
    },
    [apiUrl, refreshLocalAttachments, syncActivity, syncAllowed, withAuthRetry],
  )

  const handleSimulateMissingAttachmentFile = useCallback(
    async (localAttachmentId: string): Promise<void> => {
      await simulateMissingAttachmentFile(localAttachmentId)
      await refreshLocalAttachments()
    },
    [refreshLocalAttachments],
  )

  return { handleEnsureAttachmentPreviews, handleSimulateMissingAttachmentFile }
}
