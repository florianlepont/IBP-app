import { extensionFromMime, isAllowedMimeType } from "../src/common/file.utils"
import { isSafeId, SAFE_ID_PATTERN } from "../src/common/safe-id"

describe("isAllowedMimeType", () => {
  it.each(["image/jpeg", " IMAGE/PNG ", "image/heic", "image/webp", "image/jpg"])(
    "accepts %p",
    (mime) => {
      expect(isAllowedMimeType(mime)).toBe(true)
    },
  )

  // D-09/D-16: prototype keys must not pass the allow-list.
  it.each([
    "constructor",
    "__proto__",
    "toString",
    "hasOwnProperty",
    "valueOf",
    "image/gif",
    "",
    "text/plain",
  ])("rejects %p", (mime) => {
    expect(isAllowedMimeType(mime)).toBe(false)
  })
})

describe("extensionFromMime", () => {
  it("maps an allowed type to its extension", () => {
    expect(extensionFromMime("image/png")).toBe(".png")
    expect(extensionFromMime(" Image/JPEG ")).toBe(".jpg")
  })

  it.each(["constructor", "__proto__", "toString", "image/gif"])("throws for %p", (mime) => {
    expect(() => extensionFromMime(mime)).toThrow("Unsupported file type")
  })
})

describe("isSafeId", () => {
  it.each([
    "3f1c2b7e-8a4d-4c1e-9b2a-0d5e6f7a8b9c",
    "survey-1712345678901",
    "e2e-survey-1",
    "A_b-9",
    "a".repeat(128),
  ])("accepts %p", (value) => {
    expect(isSafeId(value)).toBe(true)
  })

  it.each(["", "a".repeat(129), "../x", "a/b", "a.b", "a b", "a%2Fb", "a\u0000b", "a\nb"])(
    "rejects %p",
    (value) => {
      expect(isSafeId(value)).toBe(false)
    },
  )

  it.each([undefined, 42, null, {}, ["a"]])("rejects non-string %p", (value) => {
    expect(isSafeId(value)).toBe(false)
  })

  it("exposes the pattern for DTO and pipe reuse", () => {
    expect(SAFE_ID_PATTERN.test("survey-1")).toBe(true)
    expect(SAFE_ID_PATTERN.test("../x")).toBe(false)
  })
})
