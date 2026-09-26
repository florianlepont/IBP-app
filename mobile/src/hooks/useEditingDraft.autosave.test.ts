/**
 * Autosave reschedule proof for useEditingDraft (audit finding: an autosave
 * that fires while the previous one is still writing must not drop the
 * latest draft). Uses the renderHook recipe from render-hook-smoke.test.ts.
 * Kept separate from useEditingDraft.test.ts, which uses the React-spy style
 * (PATTERNS: don't mix renderHook and spy styles in one file).
 */

jest.mock("react-native", () => ({
  Platform: { select: (opts: Record<string, unknown>) => opts.default ?? Object.values(opts)[0] },
}))

const mockCreateLocalDraft = jest.fn()
const mockGetLocalSurveyDraft = jest.fn()
const mockUpdateLocalDraft = jest.fn()

jest.mock("../storage/surveys", () => ({
  createLocalDraft: (...args: unknown[]) => mockCreateLocalDraft(...args),
  getLocalSurveyDraft: (...args: unknown[]) => mockGetLocalSurveyDraft(...args),
  updateLocalDraft: (...args: unknown[]) => mockUpdateLocalDraft(...args),
}))

import { act, cleanup, renderHook } from "@testing-library/react-native/pure"
import { fr } from "../i18n"
import { useEditingDraft } from "./useEditingDraft"

afterEach(async () => {
  await cleanup()
})

const TEST_SURVEY_ID = "survey-autosave-1"

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function draftInput(siteName: string) {
  return {
    site_name: siteName,
    region_version: "ACA",
    vegetation_stage: "planitiaire",
    parcel_ids: [] as string[],
    factors: {},
  }
}

function buildProps(
  siteName: string,
  editingSurveyId: string | null = TEST_SURVEY_ID,
): Parameters<typeof useEditingDraft>[0] {
  return {
    editingSurveyId,
    setEditingSurveyId: jest.fn(),
    editingSurveyVisibility: "private" as const,
    setFormMode: jest.fn(),
    surveyForm: {
      draftInput: draftInput(siteName),
      resetSurveyForm: jest.fn(),
      buildDraftInput: jest.fn(),
      applyDraftToForm: jest.fn(),
    } as never,
    surveyList: {
      surveys: [] as Record<string, unknown>[],
      refreshLocalSurveys: jest.fn().mockResolvedValue(undefined),
      refreshLocalAttachments: jest.fn().mockResolvedValue(undefined),
      setSelectedSurveyId: jest.fn(),
    } as never,
    onStatusChange: jest.fn(),
    onCloseSurveyDetail: jest.fn(),
  }
}

describe("useEditingDraft autosave reschedule", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockCreateLocalDraft.mockReset()
    mockGetLocalSurveyDraft.mockReset()
    mockUpdateLocalDraft.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("a change while the previous save is in flight is rescheduled, not dropped", async () => {
    const deferredA = createDeferred<Record<string, unknown>>()
    mockUpdateLocalDraft.mockReturnValueOnce(deferredA.promise)

    const initialProps = buildProps("A")
    const { rerender } = await renderHook(
      (props: Parameters<typeof useEditingDraft>[0]) => useEditingDraft(props),
      { initialProps },
    )

    await act(async () => {
      await jest.advanceTimersByTimeAsync(900)
    })
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(1)
    expect(mockUpdateLocalDraft).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ site_name: "A" }),
    )

    await rerender(buildProps("B"))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(900)
    })
    // The timer fired while A is still in flight: no second call yet.
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(1)

    mockUpdateLocalDraft.mockResolvedValueOnce({})
    await act(async () => {
      deferredA.resolve({})
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(2)
    expect(mockUpdateLocalDraft).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ site_name: "B" }),
    )

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000)
    })
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(2)
  })

  test("three quick changes during one in-flight save end with exactly one follow-up save carrying the latest", async () => {
    const deferredA = createDeferred<Record<string, unknown>>()
    mockUpdateLocalDraft.mockReturnValueOnce(deferredA.promise)

    const initialProps = buildProps("A")
    const { rerender } = await renderHook(
      (props: Parameters<typeof useEditingDraft>[0]) => useEditingDraft(props),
      { initialProps },
    )

    await act(async () => {
      await jest.advanceTimersByTimeAsync(900)
    })
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(1)

    await rerender(buildProps("B"))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300)
    })
    await rerender(buildProps("C"))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(900)
    })
    // Still just the one in-flight save; the quick B/C edits only update the pending request.
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(1)

    mockUpdateLocalDraft.mockResolvedValueOnce({})
    await act(async () => {
      deferredA.resolve({})
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(2)
    expect(mockUpdateLocalDraft).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ site_name: "C" }),
    )

    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000)
    })
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(2)
  })

  test("a draft identical to the last saved signature does not trigger a save", async () => {
    mockUpdateLocalDraft.mockResolvedValue({})

    const initialProps = buildProps("A")
    const { rerender } = await renderHook(
      (props: Parameters<typeof useEditingDraft>[0]) => useEditingDraft(props),
      { initialProps },
    )

    await act(async () => {
      await jest.advanceTimersByTimeAsync(900)
    })
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(1)

    // Re-render with the exact same draft input: same JSON signature as what was just saved.
    await rerender(buildProps("A"))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000)
    })
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(1)
  })

  test("after editing stops (editingSurveyId null) no pending follow-up save runs", async () => {
    const deferredA = createDeferred<Record<string, unknown>>()
    mockUpdateLocalDraft.mockReturnValueOnce(deferredA.promise)

    const initialProps = buildProps("A")
    const { rerender } = await renderHook(
      (props: Parameters<typeof useEditingDraft>[0]) => useEditingDraft(props),
      { initialProps },
    )

    await act(async () => {
      await jest.advanceTimersByTimeAsync(900)
    })
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(1)

    await rerender(buildProps("B"))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(900)
    })
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(1)

    // Editing stops entirely.
    await rerender(buildProps("B", null))

    await act(async () => {
      deferredA.resolve({})
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // No follow-up save runs: only the original in-flight save happened.
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(1)
  })

  test("an updateLocalDraft rejection reports an autosave error and a later change still saves", async () => {
    mockUpdateLocalDraft.mockRejectedValueOnce(new Error("disk full"))

    const initialProps = buildProps("A")
    const { result, rerender } = await renderHook(
      (props: Parameters<typeof useEditingDraft>[0]) => useEditingDraft(props),
      {
        initialProps,
      },
    )

    await act(async () => {
      await jest.advanceTimersByTimeAsync(900)
    })
    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(1)

    void result

    mockUpdateLocalDraft.mockResolvedValueOnce({})
    await rerender(buildProps("B"))
    await act(async () => {
      await jest.advanceTimersByTimeAsync(900)
    })

    expect(mockUpdateLocalDraft).toHaveBeenCalledTimes(2)
    expect(mockUpdateLocalDraft).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ site_name: "B" }),
    )
    expect(initialProps.onStatusChange).toHaveBeenCalledWith(fr.status.editing.autosaveFailed())
  })
})
