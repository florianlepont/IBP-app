/**
 * Context contract tests (phase 01.9, D-01).
 *
 * Part 1: every consumer hook throws a clear error outside AppStateProvider,
 * so a missing provider is never a silent default.
 */

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios },
  StyleSheet: { flatten: (s: unknown) => s },
}))

import { cleanup, renderHook } from "@testing-library/react-native/pure"
import { useAccessToken, useSession } from "./session-context"
import { useStatus } from "./status-context"
import { useSyncActions } from "./sync-actions-context"
import { useSurveys } from "./surveys-context"
import { useSurveyFormState } from "./survey-form-context"

afterEach(async () => {
  await cleanup()
})

describe("context hooks outside AppStateProvider", () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    // React logs the error thrown during render; keep the output readable.
    jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const message = String(args[0] ?? "")
      if (message.includes("must be used inside AppStateProvider")) return
      if (message.includes("The above error occurred")) return
      originalConsoleError(...(args as Parameters<typeof console.error>))
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test.each([
    ["useSession", useSession],
    ["useAccessToken", useAccessToken],
    ["useStatus", useStatus],
    ["useSyncActions", useSyncActions],
    ["useSurveys", useSurveys],
    ["useSurveyFormState", useSurveyFormState],
  ] as const)("%s throws a clear error", async (name, hook) => {
    await expect(renderHook(() => hook())).rejects.toThrow(
      `${name} must be used inside AppStateProvider`,
    )
  })
})
