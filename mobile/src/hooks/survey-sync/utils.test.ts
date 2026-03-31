jest.mock("expo-network")

import {
  guessMimeType,
  isUnauthorizedResultMessage,
  isOnlineNetworkState,
  formatSubmitReadinessError,
} from "./utils"

describe("guessMimeType", () => {
  test("returns image/jpeg for .jpg", () => expect(guessMimeType("photo.jpg")).toBe("image/jpeg"))
  test("returns image/jpeg for .jpeg", () => expect(guessMimeType("PHOTO.JPEG")).toBe("image/jpeg"))
  test("returns image/png for .png", () => expect(guessMimeType("image.PNG")).toBe("image/png"))
  test("returns image/heic for .heic", () => expect(guessMimeType("photo.heic")).toBe("image/heic"))
  test("returns image/webp for .webp", () => expect(guessMimeType("photo.webp")).toBe("image/webp"))
  test("returns application/octet-stream for unknown extension", () =>
    expect(guessMimeType("file.pdf")).toBe("application/octet-stream"))
  test("returns application/octet-stream for no extension", () =>
    expect(guessMimeType("noextension")).toBe("application/octet-stream"))
})

describe("isUnauthorizedResultMessage", () => {
  test("matches standalone '401'", () =>
    expect(isUnauthorizedResultMessage("HTTP 401 error")).toBe(true))
  test("matches 'unauthorized' (case insensitive)", () =>
    expect(isUnauthorizedResultMessage("Unauthorized request")).toBe(true))
  test("matches 'auth_required'", () =>
    expect(isUnauthorizedResultMessage("auth_required")).toBe(true))
  test("does not match '4010' (digits around 401)", () =>
    expect(isUnauthorizedResultMessage("error 4010")).toBe(false))
  test("does not match '1401'", () =>
    expect(isUnauthorizedResultMessage("error 1401")).toBe(false))
  test("does not match unrelated message", () =>
    expect(isUnauthorizedResultMessage("Network error")).toBe(false))
})

describe("isOnlineNetworkState", () => {
  test("returns true when connected and reachable", () => {
    expect(isOnlineNetworkState({ isConnected: true, isInternetReachable: true, type: "WIFI" as never })).toBe(true)
  })

  test("returns true when connected and reachable is undefined (treats as reachable)", () => {
    expect(isOnlineNetworkState({ isConnected: true, isInternetReachable: undefined, type: "WIFI" as never })).toBe(true)
  })

  test("returns false when not connected", () => {
    expect(isOnlineNetworkState({ isConnected: false, isInternetReachable: false, type: "NONE" as never })).toBe(false)
  })

  test("returns false when connected but not reachable", () => {
    expect(isOnlineNetworkState({ isConnected: true, isInternetReachable: false, type: "WIFI" as never })).toBe(false)
  })

  test("returns false when isConnected is undefined", () => {
    expect(isOnlineNetworkState({ isConnected: undefined, isInternetReachable: true, type: "NONE" as never })).toBe(false)
  })
})

describe("formatSubmitReadinessError", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeReadiness(overrides: Record<string, unknown> = {}): any {
    return {
      expired: false,
      missing_factors: [],
      missing_fields: [],
      ready: true,
      ...overrides,
    }
  }

  test("returns expired message when expired", () => {
    const msg = formatSubmitReadinessError("survey-1", makeReadiness({ expired: true }))
    expect(msg).toContain("expired")
    expect(msg).toContain("survey-1")
  })

  test("returns generic 'not ready' message when nothing is missing", () => {
    const msg = formatSubmitReadinessError("survey-1", makeReadiness())
    expect(msg).toContain("not ready")
    expect(msg).toContain("survey-1")
  })

  test("includes missing factors in message", () => {
    const msg = formatSubmitReadinessError("s1", makeReadiness({ missing_factors: ["A1", "B2"] }))
    expect(msg).toContain("A1")
    expect(msg).toContain("B2")
  })

  test("includes missing region_version", () => {
    const msg = formatSubmitReadinessError("s1", makeReadiness({ missing_fields: ["region_version"] }))
    expect(msg).toContain("region version")
  })

  test("includes missing vegetation_stage", () => {
    const msg = formatSubmitReadinessError("s1", makeReadiness({ missing_fields: ["vegetation_stage"] }))
    expect(msg).toContain("vegetation stage")
  })

  test("includes missing parcel_ids", () => {
    const msg = formatSubmitReadinessError("s1", makeReadiness({ missing_fields: ["parcel_ids"] }))
    expect(msg).toContain("parcel selection")
  })

  test("combines multiple missing fields with separator", () => {
    const msg = formatSubmitReadinessError("s1", makeReadiness({
      missing_factors: ["A1"],
      missing_fields: ["region_version"],
    }))
    expect(msg).toContain("|")
  })
})
