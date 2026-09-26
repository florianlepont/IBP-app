import { BadRequestException } from "@nestjs/common"
import { isStrictTimestamp } from "./surveys-normalize.utils"

// D-11: opaque keyset cursor for the paginated lists. The wire form is
// `v1:` + base64url(JSON { t, i }), where `t` is the sort timestamp and `i` the tiebreaker id.
// D-12: decoding is strict (the same timestamp validator as the legacy sync cursor) so a crafted
// cursor can never reach a `::timestamptz` cast, and every failure answers a fixed 400 message
// that never echoes the input.
export type ListCursor = { t: string; i: string }

export const LIST_LIMIT_MAX = 100

const LIST_CURSOR_PREFIX = "v1:"
const LIST_CURSOR_BODY_MAX = 512
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/
const DEFAULT_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/
const LIMIT_PATTERN = /^\d{1,3}$/

export function encodeListCursor(cursor: ListCursor): string {
  const json = JSON.stringify({ t: cursor.t, i: cursor.i })
  return `${LIST_CURSOR_PREFIX}${Buffer.from(json, "utf8").toString("base64url")}`
}

export function decodeListCursor(
  raw: string | undefined,
  options?: { idPattern?: RegExp },
): ListCursor | null {
  if (raw === undefined || raw === "") {
    return null
  }
  const invalid = () => new BadRequestException("Invalid cursor")

  if (typeof raw !== "string" || !raw.startsWith(LIST_CURSOR_PREFIX)) {
    throw invalid()
  }
  const body = raw.slice(LIST_CURSOR_PREFIX.length)
  if (body.length === 0 || body.length > LIST_CURSOR_BODY_MAX || !BASE64URL_PATTERN.test(body)) {
    throw invalid()
  }

  const buffer = Buffer.from(body, "base64url")
  // Node's decoder is lenient; requiring the canonical re-encoding refuses padding and
  // trailing-bit tricks, so each logical cursor has exactly one accepted spelling.
  if (buffer.toString("base64url") !== body) {
    throw invalid()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(buffer.toString("utf8"))
  } catch {
    throw invalid()
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw invalid()
  }
  const keys = Object.keys(parsed)
  if (keys.length !== 2 || !keys.includes("t") || !keys.includes("i")) {
    throw invalid()
  }
  const { t, i } = parsed as { t: unknown; i: unknown }
  const idPattern = options?.idPattern ?? DEFAULT_ID_PATTERN
  if (typeof t !== "string" || typeof i !== "string" || !isStrictTimestamp(t)) {
    throw invalid()
  }
  // Reset lastIndex so a caller-supplied global or sticky pattern cannot skip a match.
  idPattern.lastIndex = 0
  if (!idPattern.test(i)) {
    throw invalid()
  }
  return { t, i }
}

// D-11: absent or empty means unpaginated (today's behaviour); otherwise an integer 1..100.
export function parseListLimit(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") {
    return null
  }
  if (typeof raw !== "string" || !LIMIT_PATTERN.test(raw)) {
    throw new BadRequestException("Invalid limit")
  }
  const limit = Number(raw)
  if (limit < 1 || limit > LIST_LIMIT_MAX) {
    throw new BadRequestException("Invalid limit")
  }
  return limit
}
