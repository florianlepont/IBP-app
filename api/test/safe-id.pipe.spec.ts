import { ArgumentMetadata, BadRequestException } from "@nestjs/common"
import { SafeIdPipe } from "../src/common/safe-id.pipe"

const meta: ArgumentMetadata = { type: "param", data: "id", metatype: String }

describe("SafeIdPipe", () => {
  const pipe = new SafeIdPipe()

  it.each([
    "survey-1712345678901",
    "3f2b8c1e-9a4d-4e2f-8b6a-1c2d3e4f5a6b",
    "e2e-survey-1712345678901",
    "A_b-9",
    "a".repeat(128),
  ])("returns the safe id %s unchanged", (value) => {
    expect(pipe.transform(value, meta)).toBe(value)
  })

  it.each([
    ["../x", "../x"],
    ["a/b", "a/b"],
    ["a.b", "a.b"],
    ["empty", ""],
    ["129 chars", "a".repeat(129)],
    ["undefined", undefined],
    ["number", 42],
    ["NUL", "a\u0000b"],
  ])("rejects %s with a fixed message", (_label, value) => {
    let caught: unknown
    try {
      pipe.transform(value, meta)
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(BadRequestException)
    const exception = caught as BadRequestException
    expect(exception.message).toBe("Invalid identifier")
    if (typeof value === "string" && value.length > 0) {
      expect(JSON.stringify(exception.getResponse())).not.toContain(value)
    }
  })
})
