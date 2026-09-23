import { extractIdTokenClaims } from "./id-token"

function base64url(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function buildToken(payload: unknown): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const body = base64url(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

describe("extractIdTokenClaims", () => {
  test("decodes sub and email from a well-formed token", () => {
    const token = buildToken({ sub: "auth0|abc", email: "a@b.fr" })
    expect(extractIdTokenClaims(token)).toEqual({ sub: "auth0|abc", email: "a@b.fr" })
  })

  test("decodes a non-ASCII email correctly (UTF-8)", () => {
    const token = buildToken({ sub: "auth0|abc", email: "éa@b.fr" })
    expect(extractIdTokenClaims(token)).toEqual({ sub: "auth0|abc", email: "éa@b.fr" })
  })

  test("returns email null when the payload has no email", () => {
    const token = buildToken({ sub: "auth0|abc" })
    expect(extractIdTokenClaims(token)).toEqual({ sub: "auth0|abc", email: null })
  })

  test("returns null when sub is missing", () => {
    const token = buildToken({ email: "a@b.fr" })
    expect(extractIdTokenClaims(token)).toBeNull()
  })

  test("returns null when sub is an empty string", () => {
    const token = buildToken({ sub: "", email: "a@b.fr" })
    expect(extractIdTokenClaims(token)).toBeNull()
  })

  test("returns null for a non-JSON payload segment", () => {
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    const token = `${header}.${base64url("not-json")}.sig`
    expect(extractIdTokenClaims(token)).toBeNull()
  })

  test("returns null when the token has fewer than 3 segments", () => {
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    const body = base64url(JSON.stringify({ sub: "auth0|abc" }))
    expect(extractIdTokenClaims(`${header}.${body}`)).toBeNull()
  })

  test("returns null for empty string, null and undefined", () => {
    expect(extractIdTokenClaims("")).toBeNull()
    expect(extractIdTokenClaims(null)).toBeNull()
    expect(extractIdTokenClaims(undefined)).toBeNull()
  })
})
