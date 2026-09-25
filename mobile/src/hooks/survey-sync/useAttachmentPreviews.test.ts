/**
 * D-11 hook proof: screens ask for previews with one call; downloads are
 * bounded, de-duplicated, owner-gated (syncAllowed) and purge-safe.
 */

jest.mock("react-native", () => ({}))

// auth-errors.ts imports react-native-auth0 for CredentialsManagerError; mock it
// minimally so the module resolves under the node test environment (no native code).
jest.mock("react-native-auth0", () => ({
  CredentialsManagerError: class MockCredentialsManagerError extends Error {},
  CredentialsManagerErrorCodes: {},
}))

const mockEnsureAttachmentCached = jest.fn()
const mockSimulateMissingAttachmentFile = jest.fn()
jest.mock("../../storage/attachment-cache", () => ({
  ensureAttachmentCached: (...args: unknown[]) => mockEnsureAttachmentCached(...args),
  simulateMissingAttachmentFile: (...args: unknown[]) => mockSimulateMissingAttachmentFile(...args),
}))

import { cleanup, renderHook, waitFor } from "@testing-library/react-native/pure"
import type { LocalAttachment } from "../../storage/types"
import { AUTH_REQUIRED_ERROR } from "../auth-errors"
import { createSyncActivity, SYNC_SUSPENDED_ERROR } from "./sync-activity"
import { useAttachmentPreviews } from "./useAttachmentPreviews"

afterEach(async () => {
  await cleanup()
  jest.clearAllMocks()
})

function makeAttachment(
  id: string,
  fileState: LocalAttachment["file_state"],
  updatedAt = "2026-01-01T00:00:00.000Z",
): LocalAttachment {
  return {
    id,
    survey_id: "survey-1",
    local_uri: fileState === "local" ? `file:///mock/documents/attachments/${id}.jpg` : "",
    mime_type: "image/jpeg",
    size_bytes: 100,
    sync_state: "synced",
    remote_attachment_id: fileState === "remote" ? `srv-${id}` : null,
    storage_key: null,
    upload_url: null,
    confirm_url: null,
    last_sync_error: null,
    last_sync_error_code: null,
    last_sync_error_at: null,
    updated_at: updatedAt,
    file_state: fileState,
  }
}

async function buildHook(overrides: { syncAllowed?: boolean } = {}) {
  const withAuthRetry = jest.fn((fn: (token: string, tokenSub: string | null) => unknown) =>
    fn("token-abc", "auth0|a"),
  )
  const refreshLocalAttachments = jest.fn().mockResolvedValue(undefined)
  const syncActivity = createSyncActivity()

  const rendered = await renderHook(() =>
    useAttachmentPreviews({
      apiUrl: "http://localhost:3000/v1",
      withAuthRetry,
      syncActivity,
      syncAllowed: overrides.syncAllowed ?? true,
      refreshLocalAttachments,
    } as never),
  )

  return { rendered, withAuthRetry, refreshLocalAttachments, syncActivity }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe("useAttachmentPreviews", () => {
  test("selects remote and local rows, never missing/unavailable, and re-checks local rows only once", async () => {
    mockEnsureAttachmentCached.mockResolvedValue("ready")
    const { rendered, refreshLocalAttachments } = await buildHook()

    const a = makeAttachment("a", "remote")
    const b = makeAttachment("b", "remote")
    const d = makeAttachment("d", "local")
    const m = makeAttachment("m", "missing")
    const u = makeAttachment("u", "unavailable")

    await rendered.result.current.handleEnsureAttachmentPreviews([a, b, d, m, u])

    expect(mockEnsureAttachmentCached).toHaveBeenCalledTimes(3)
    const calledIds = mockEnsureAttachmentCached.mock.calls.map((call) => call[2]).sort()
    expect(calledIds).toEqual(["a", "b", "d"])
    expect(refreshLocalAttachments).toHaveBeenCalledTimes(1)

    mockEnsureAttachmentCached.mockClear()
    refreshLocalAttachments.mockClear()

    // Second call with the same (stale) list: a and b are still "remote" in
    // the props, so they are requested again; d ("local") was already
    // checked once this session and is never requested again.
    await rendered.result.current.handleEnsureAttachmentPreviews([a, b, d, m, u])

    expect(mockEnsureAttachmentCached).toHaveBeenCalledTimes(2)
    const secondCallIds = mockEnsureAttachmentCached.mock.calls.map((call) => call[2]).sort()
    expect(secondCallIds).toEqual(["a", "b"])
  })

  test("never runs more than 2 ensureAttachmentCached calls concurrently", async () => {
    const deferredMap = new Map<string, ReturnType<typeof deferred<string>>>()
    mockEnsureAttachmentCached.mockImplementation((_apiUrl: string, _token: string, id: string) => {
      const entry = deferred<string>()
      deferredMap.set(id, entry)
      return entry.promise
    })
    const { rendered } = await buildHook()

    const attachments = ["a", "b", "c"].map((id) => makeAttachment(id, "remote"))
    const call = rendered.result.current.handleEnsureAttachmentPreviews(attachments)

    await waitFor(() => expect(mockEnsureAttachmentCached).toHaveBeenCalledTimes(2))
    expect(deferredMap.has("c")).toBe(false)

    deferredMap.get("a")?.resolve("ready")
    await waitFor(() => expect(mockEnsureAttachmentCached).toHaveBeenCalledTimes(3))

    deferredMap.get("b")?.resolve("ready")
    deferredMap.get("c")?.resolve("ready")
    await call
  })

  test("a concurrent second call does not start a second download for ids already in flight", async () => {
    const entry = deferred<string>()
    mockEnsureAttachmentCached.mockReturnValue(entry.promise)
    const { rendered } = await buildHook()

    const attachments = [makeAttachment("a", "remote")]
    const firstCall = rendered.result.current.handleEnsureAttachmentPreviews(attachments)
    const secondCall = rendered.result.current.handleEnsureAttachmentPreviews(attachments)

    entry.resolve("ready")
    await Promise.all([firstCall, secondCall])

    expect(mockEnsureAttachmentCached).toHaveBeenCalledTimes(1)
  })

  test("an unavailable result is not re-requested while updated_at is unchanged, but is requested again after a pull resets it", async () => {
    mockEnsureAttachmentCached.mockResolvedValue("unavailable")
    const { rendered, refreshLocalAttachments } = await buildHook()

    const staleAttachment = makeAttachment("a", "remote", "2026-01-01T00:00:00.000Z")
    await rendered.result.current.handleEnsureAttachmentPreviews([staleAttachment])
    expect(mockEnsureAttachmentCached).toHaveBeenCalledTimes(1)
    expect(refreshLocalAttachments).toHaveBeenCalledTimes(1)

    mockEnsureAttachmentCached.mockClear()
    refreshLocalAttachments.mockClear()

    // Stale props still say "remote" with the same updated_at: not re-requested.
    await rendered.result.current.handleEnsureAttachmentPreviews([staleAttachment])
    expect(mockEnsureAttachmentCached).not.toHaveBeenCalled()
    expect(refreshLocalAttachments).not.toHaveBeenCalled()

    // A pull reset the attachment to "remote" with a new updated_at: eligible again.
    mockEnsureAttachmentCached.mockResolvedValue("ready")
    const resetAttachment = makeAttachment("a", "remote", "2026-02-01T00:00:00.000Z")
    await rendered.result.current.handleEnsureAttachmentPreviews([resetAttachment])
    expect(mockEnsureAttachmentCached).toHaveBeenCalledTimes(1)
  })

  test("refreshLocalAttachments is not called when nothing changed", async () => {
    mockEnsureAttachmentCached.mockResolvedValue("remote")
    const { rendered, refreshLocalAttachments } = await buildHook()

    await rendered.result.current.handleEnsureAttachmentPreviews([makeAttachment("a", "remote")])

    expect(refreshLocalAttachments).not.toHaveBeenCalled()
  })

  test("syncAllowed false: no call at all", async () => {
    const { rendered } = await buildHook({ syncAllowed: false })

    await rendered.result.current.handleEnsureAttachmentPreviews([makeAttachment("a", "remote")])

    expect(mockEnsureAttachmentCached).not.toHaveBeenCalled()
  })

  test("goes through withAuthRetry and syncActivity.run; SYNC_SUSPENDED stops the batch silently", async () => {
    mockEnsureAttachmentCached.mockRejectedValue(new Error(SYNC_SUSPENDED_ERROR))
    const { rendered, withAuthRetry, refreshLocalAttachments } = await buildHook()

    await expect(
      rendered.result.current.handleEnsureAttachmentPreviews([makeAttachment("a", "remote")]),
    ).resolves.toBeUndefined()

    expect(withAuthRetry).toHaveBeenCalled()
    expect(refreshLocalAttachments).not.toHaveBeenCalled()
  })

  test("an AUTH_REQUIRED error stops the batch without throwing", async () => {
    mockEnsureAttachmentCached.mockRejectedValue(new Error(AUTH_REQUIRED_ERROR))
    const { rendered } = await buildHook()

    await expect(
      rendered.result.current.handleEnsureAttachmentPreviews([makeAttachment("a", "remote")]),
    ).resolves.toBeUndefined()
  })

  test("handleSimulateMissingAttachmentFile calls simulateMissingAttachmentFile then refreshLocalAttachments", async () => {
    mockSimulateMissingAttachmentFile.mockResolvedValue(undefined)
    const { rendered, refreshLocalAttachments } = await buildHook()

    await rendered.result.current.handleSimulateMissingAttachmentFile("attachment-1")

    expect(mockSimulateMissingAttachmentFile).toHaveBeenCalledWith("attachment-1")
    expect(refreshLocalAttachments).toHaveBeenCalledTimes(1)
  })
})
