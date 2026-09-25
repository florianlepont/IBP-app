import { BadRequestException } from "@nestjs/common"
import {
  LIST_LIMIT_MAX,
  decodeListCursor,
  encodeListCursor,
  parseListLimit,
} from "../src/surveys/list-cursor"

function b64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function v1(value: unknown): string {
  return `v1:${b64url(JSON.stringify(value))}`
}

function expectInvalidCursor(raw: string, options?: { idPattern?: RegExp }): void {
  let thrown: unknown
  try {
    decodeListCursor(raw, options)
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(BadRequestException)
  const exception = thrown as BadRequestException
  expect(exception.message).toBe("Invalid cursor")
  expect(JSON.stringify(exception.getResponse())).not.toContain(raw)
}

describe("encodeListCursor / decodeListCursor", () => {
  it("round-trips a cursor", () => {
    const cursor = { t: "2026-03-09 10:20:31.991234+00", i: "survey-1" }
    const encoded = encodeListCursor(cursor)
    expect(encoded).toBe(`v1:${b64url(JSON.stringify(cursor))}`)
    expect(decodeListCursor(encoded)).toEqual(cursor)
  })

  it("accepts an id matching a custom pattern", () => {
    const encoded = encodeListCursor({ t: "2026-03-09T10:20:31Z", i: "12345" })
    expect(decodeListCursor(encoded, { idPattern: /^\d{1,19}$/ })).toEqual({
      t: "2026-03-09T10:20:31Z",
      i: "12345",
    })
  })

  it.each([undefined, ""])("returns null for %p", (raw) => {
    expect(decodeListCursor(raw)).toBeNull()
  })

  it.each([
    ["garbage", "garbage"],
    ["a v2 cursor", "v2:abc"],
    ["an empty v1 body", "v1:"],
    ["a non-JSON body", `v1:${b64url("not json")}`],
    ["a body over 512 characters", `v1:${"A".repeat(513)}`],
    ["an impossible timestamp", v1({ t: "2024-02-30T00:00:00Z", i: "x" })],
    ["a numeric id", v1({ t: "2026-03-09T10:20:31Z", i: 5 })],
    ["an id with a space", v1({ t: "2026-03-09T10:20:31Z", i: "a b" })],
    ["an extra-key-only object", v1({ x: "y" })],
    ["an object with an extra key", v1({ t: "2026-03-09T10:20:31Z", i: "a", x: 1 })],
    ["a JSON array", v1(["2026-03-09T10:20:31Z", "a"])],
    ["a JSON null", `v1:${b64url("null")}`],
    ["a padded body", `${encodeListCursor({ t: "2026-03-09T10:20:31Z", i: "a" })}=`],
    ["a standard base64 alphabet body", "v1:+/+/"],
  ])("throws Invalid cursor for %s", (_label, raw) => {
    expectInvalidCursor(raw)
  })

  it("throws Invalid cursor when the id does not match the given pattern", () => {
    const encoded = encodeListCursor({ t: "2026-03-09T10:20:31Z", i: "abc" })
    expectInvalidCursor(encoded, { idPattern: /^\d{1,19}$/ })
  })
})

describe("parseListLimit", () => {
  it("exposes the maximum", () => {
    expect(LIST_LIMIT_MAX).toBe(100)
  })

  it.each([
    [undefined, null],
    ["", null],
    ["1", 1],
    ["42", 42],
    ["100", 100],
  ])("parses %p as %p", (raw, expected) => {
    expect(parseListLimit(raw)).toBe(expected)
  })

  it.each(["0", "101", "-1", "1.5", "abc", "1000", " 5", "1e2"])(
    "throws Invalid limit for %p",
    (raw) => {
      expect(() => parseListLimit(raw)).toThrow(BadRequestException)
      expect(() => parseListLimit(raw)).toThrow("Invalid limit")
    },
  )
})
