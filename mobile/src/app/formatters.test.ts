import {
  formatRemainingTime,
  isLessThan24HoursRemaining,
  resolveSubmissionDeadline,
} from "./formatters"

describe("formatters time helpers", () => {
  const fixedNow = Date.parse("2026-03-10T12:00:00.000Z")

  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(fixedNow)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test("resolves deadline from created_at when expires_at is missing", () => {
    const createdAt = "2026-03-01T00:00:00.000Z"
    expect(resolveSubmissionDeadline(createdAt, null)).toBe("2026-03-08T00:00:00.000Z")
  })

  test("detects less than 24h remaining", () => {
    expect(isLessThan24HoursRemaining("2026-03-11T11:00:00.000Z")).toBe(true)
    expect(isLessThan24HoursRemaining("2026-03-12T12:00:00.000Z")).toBe(false)
  })

  test("formats expired deadline", () => {
    expect(formatRemainingTime("2026-03-09T11:59:00.000Z")).toBe("expired")
  })
})
