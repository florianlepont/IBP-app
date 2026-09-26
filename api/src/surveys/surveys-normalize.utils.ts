import { BadRequestException } from "@nestjs/common"
import { SurveyPatchBody, SurveyRow, SurveyUpsertBody } from "./surveys.types"

export function normalizeSurveyStatusFilter(status?: string): SurveyRow["status"] | null {
  if (!status || typeof status !== "string") {
    return null
  }

  const normalized = status.trim().toLowerCase()
  if (
    normalized === "draft" ||
    normalized === "submitted" ||
    normalized === "synced" ||
    normalized === "error" ||
    normalized === "expired"
  ) {
    return normalized
  }

  return null
}

export function getSubmittedReadOnlyFields(body: SurveyPatchBody): string[] {
  const readonlyFields: Array<keyof SurveyPatchBody> = [
    "site_name",
    "parcel_id",
    "parcel_ids",
    "observation_year",
    "version_number",
    "previous_survey_id",
    "region_version",
    "vegetation_stage",
    "factors",
    "scores",
  ]

  return readonlyFields.filter((field) => Object.prototype.hasOwnProperty.call(body, field))
}

function jsonDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((item, index) => jsonDeepEqual(item, b[index]))
  }

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null

  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) {
      return false
    }
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) {
      return false
    }
    return aKeys.every((key) => jsonDeepEqual(a[key], b[key]))
  }

  return false
}

function parcelIdSetEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size !== setB.size) {
    return false
  }
  for (const value of setA) {
    if (!setB.has(value)) {
      return false
    }
  }
  return true
}

/**
 * Value comparison of the read-only fields of a submitted survey, for the
 * upsert path (D-04, D-13). Unlike getSubmittedReadOnlyFields (key-presence
 * check used by PATCH), this reports a field only when its (normalized)
 * value actually differs from what is stored. Absent/undefined/null fields
 * on `body` are treated as "unchanged" and never reported. `scores` is
 * excluded: it is recomputed server-side and must never block a resync.
 */
export function getChangedSubmittedReadOnlyFields(
  body: SurveyUpsertBody,
  existing: SurveyRow,
  existingParcelIds: string[],
): string[] {
  const readonlyFields: Array<Exclude<keyof SurveyPatchBody, "scores">> = [
    "site_name",
    "parcel_id",
    "parcel_ids",
    "observation_year",
    "version_number",
    "previous_survey_id",
    "region_version",
    "vegetation_stage",
    "factors",
  ]

  const changed: string[] = []

  for (const field of readonlyFields) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) {
      continue
    }
    const bodyValue = (body as Record<string, unknown>)[field]
    if (bodyValue === undefined || bodyValue === null) {
      continue
    }

    switch (field) {
      case "site_name": {
        if (bodyValue !== existing.site_name) {
          changed.push(field)
        }
        break
      }
      case "parcel_id": {
        if (normalizeParcelId(bodyValue) !== normalizeParcelId(existing.parcel_id)) {
          changed.push(field)
        }
        break
      }
      case "parcel_ids": {
        const bodyParcelIds = normalizeParcelIds(bodyValue)
        const baselineParcelIds =
          existingParcelIds.length > 0
            ? existingParcelIds
            : existing.parcel_id
              ? [existing.parcel_id]
              : []
        if (!parcelIdSetEqual(bodyParcelIds, normalizeParcelIds(baselineParcelIds))) {
          changed.push(field)
        }
        break
      }
      case "observation_year": {
        if (normalizeObservationYear(bodyValue) !== existing.observation_year) {
          changed.push(field)
        }
        break
      }
      case "version_number": {
        if (normalizeVersionNumber(bodyValue) !== existing.version_number) {
          changed.push(field)
        }
        break
      }
      case "previous_survey_id": {
        if (normalizePreviousSurveyId(bodyValue) !== existing.previous_survey_id) {
          changed.push(field)
        }
        break
      }
      case "region_version": {
        if (bodyValue !== existing.region_version) {
          changed.push(field)
        }
        break
      }
      case "vegetation_stage": {
        if (bodyValue !== existing.vegetation_stage) {
          changed.push(field)
        }
        break
      }
      case "factors": {
        if (!jsonDeepEqual(bodyValue, existing.factors ?? {})) {
          changed.push(field)
        }
        break
      }
      default:
        break
    }
  }

  return changed
}

export type SameVersionContent = "identical" | "visibility_only" | "conflict"

/**
 * Classify an upsert that carries the sync_version the server already stored
 * (D-04, D-16 amended 2026-09-25).
 *
 * - "conflict": a read-only field differs by value. Racing writers on the same
 *   version must not overwrite each other silently, so the caller answers 409.
 * - "visibility_only": only visibility differs. Visibility is last-writer-wins,
 *   like the version-less visibility_update action: installed apps rewrite a
 *   pending upsert's visibility without bumping sync_version, so a retry after
 *   a lost response must be applied, not blocked.
 * - "identical": an idempotent replay.
 *
 * The comparison is by value and computed on the fly (no stored hash): JSONB
 * reorders object keys, so hashing raw JSON would report false conflicts.
 * scores, status and expires_at are excluded, and absent or null body fields
 * are never treated as changes.
 */
export function classifySameVersionContent(
  body: SurveyUpsertBody,
  existing: SurveyRow,
  existingParcelIds: string[],
): SameVersionContent {
  if (getChangedSubmittedReadOnlyFields(body, existing, existingParcelIds).length > 0) {
    return "conflict"
  }
  if ((body.visibility ?? existing.visibility) !== existing.visibility) {
    return "visibility_only"
  }
  return "identical"
}

export function normalizeParcelId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const normalized = value.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

export function normalizeParcelIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const normalized: string[] = []
  for (const candidate of value) {
    const parcelId = normalizeParcelId(candidate)
    if (!parcelId || seen.has(parcelId)) {
      continue
    }
    seen.add(parcelId)
    normalized.push(parcelId)
  }
  return normalized
}

export function normalizeObservationYear(value: unknown): number | null {
  const parsed = toFiniteNumber(value)
  if (parsed === null) {
    return null
  }
  const integer = Math.trunc(parsed)
  if (integer < 1900 || integer > 2200) {
    return null
  }
  return integer
}

export function normalizeVersionNumber(value: unknown): number | null {
  const parsed = toFiniteNumber(value)
  if (parsed === null) {
    return null
  }
  const integer = Math.trunc(parsed)
  return integer >= 1 ? integer : null
}

export function normalizePreviousSurveyId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function normalizeCentroid(
  value: Record<string, unknown>,
): { lat: number; lng: number } | null {
  const lat = toFiniteNumber(value.lat)
  const lng = toFiniteNumber(value.lng)
  if (lat === null || lng === null) {
    return null
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null
  }
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  }
}

export function parseParcelIdentifier(parcelId: string): {
  communeCode: string
  section: string
  number: string
} {
  const normalized = parcelId.trim().toUpperCase()
  const match = /^(\d{5})([A-Z]{1,3})(\d{1,4})$/.exec(normalized)
  if (match) {
    return {
      communeCode: match[1],
      section: match[2].padEnd(2, "A").slice(0, 3),
      number: match[3].padStart(4, "0").slice(-4),
    }
  }
  return {
    communeCode: "00000",
    section: "AA",
    number: "0000",
  }
}

export function normalizeParcelHistoryLimit(limitRaw?: string): number {
  const parsed = toFiniteNumber(limitRaw)
  if (parsed === null) {
    return 20
  }
  const integer = Math.trunc(parsed)
  if (integer <= 0) {
    return 20
  }
  return Math.min(100, integer)
}

export function parseBbox(
  raw?: string,
): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  if (!raw || raw.trim().length === 0) {
    return null
  }

  const parts = raw.split(",").map((part) => part.trim())
  if (parts.length !== 4) {
    throw new BadRequestException("bbox must contain exactly 4 comma-separated numbers")
  }

  const minLng = toFiniteNumber(parts[0])
  const minLat = toFiniteNumber(parts[1])
  const maxLng = toFiniteNumber(parts[2])
  const maxLat = toFiniteNumber(parts[3])
  if (minLng === null || minLat === null || maxLng === null || maxLat === null) {
    throw new BadRequestException("bbox contains invalid coordinate values")
  }
  if (minLng >= maxLng || minLat >= maxLat) {
    throw new BadRequestException("bbox bounds are invalid")
  }

  return { minLng, minLat, maxLng, maxLat }
}

export function buildFallbackParcelGeometry(centroid: {
  lat: number
  lng: number
}): Record<string, unknown> {
  // Approximate 20m square used when true cadastre geometry is unavailable.
  const halfLat = 0.00009
  const halfLng = 0.00013
  const minLat = Math.max(-90, centroid.lat - halfLat)
  const maxLat = Math.min(90, centroid.lat + halfLat)
  const minLng = Math.max(-180, centroid.lng - halfLng)
  const maxLng = Math.min(180, centroid.lng + halfLng)

  return {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  }
}

export function normalizeParcelPartToDigits(value: unknown, width: number): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null
  }
  const digits = String(value)
    .trim()
    .replace(/[^0-9]/g, "")
  if (digits.length === 0) {
    return null
  }
  return digits.padStart(width, "0").slice(-width)
}

export function normalizeParcelSection(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null
  }
  const normalized = String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
  if (normalized.length === 0) {
    return null
  }
  return normalized.slice(0, 3)
}

export function buildParcelKey(communeCode: string, section: string, number: string): string {
  return `${communeCode}|${section.toUpperCase()}|${number}`
}

export function normalizeChangesLimit(limitRaw?: number): number {
  if (!Number.isFinite(limitRaw)) return 50
  const integer = Math.trunc(limitRaw ?? 0)
  if (integer <= 0) return 50
  return Math.min(200, integer)
}

// Changes-feed cursor (D-01, D-12, D-13). The mobile app stores and replays the cursor without
// parsing it, so the server is free to change the format. `v2:<xid8>:<seq>` pages on the
// (xid8, seq) pair; the legacy `<created_at text>|<event or survey id>` form is still accepted
// and translated by the feed. xid8 and seq stay strings: both can exceed Number.MAX_SAFE_INTEGER.
export type SyncChangesCursor =
  | { kind: "none"; original: null }
  | { kind: "position"; xid8: string; seq: string; original: string }
  | { kind: "legacy"; timestamp: string; eventId: string; original: string }

export const SYNC_CURSOR_V2_PATTERN = /^v2:(\d{1,20}):(\d{1,19})$/
const XID8_MAX = BigInt("18446744073709551615")
const BIGINT_MAX = BigInt("9223372036854775807")

// D-12: the one strict timestamp check shared by the legacy sync cursor and the `v1:` list
// cursors (list-cursor.ts). It accepts the PostgreSQL `timestamptz::text` output that installed
// apps replay ("2026-03-09 10:20:31.991234+00") and ISO strings ("2026-03-09T10:20:31.991Z"),
// and it rejects anything the `::timestamptz` cast would refuse: impossible dates (Feb 30,
// month 13, hour 24), trailing junk, more than six fractional digits, a missing offset, year 0,
// and offsets beyond PostgreSQL's +/-15:59 limit.
const STRICT_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?(Z|[+-](\d{2})(?::?(\d{2}))?)$/

export function isStrictTimestamp(value: string): boolean {
  if (typeof value !== "string") return false
  const match = STRICT_TIMESTAMP_PATTERN.exec(value)
  if (!match) return false

  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  if (year < 1) return false

  const offsetHours = match[9] === undefined ? 0 : Number(match[9])
  const offsetMinutes = match[10] === undefined ? 0 : Number(match[10])
  if (offsetHours > 15 || offsetMinutes > 59) return false

  // Round-trip the wall-clock components: the UTC setters normalise overflow (Feb 30 becomes
  // Mar 1, hour 24 becomes the next day), so any component that changes means the input named an
  // impossible instant. setUTCFullYear, unlike Date.UTC, keeps years 1..99 literal.
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, second)
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  )
}

export function parseSyncChangesCursor(cursor?: string): SyncChangesCursor {
  if (!cursor || cursor.trim().length === 0) {
    return { kind: "none", original: null }
  }

  const position = SYNC_CURSOR_V2_PATTERN.exec(cursor)
  if (position) {
    // Out-of-range values would make the `::xid8` / `::bigint` casts fail with a 500.
    if (BigInt(position[1]) > XID8_MAX || BigInt(position[2]) > BIGINT_MAX) {
      throw new BadRequestException("Invalid sync cursor")
    }
    return { kind: "position", xid8: position[1], seq: position[2], original: cursor }
  }
  if (cursor.startsWith("v2:")) {
    throw new BadRequestException("Invalid sync cursor")
  }

  // Every legacy cursor was built as `${timestamptz}|${id}`. The timestamp half goes through the
  // strict validator (D-12) because it is later cast with `::timestamptz`: a looser check let
  // "2024-02-30T00:00:00Z|x" through and the cast raised 22008, answering 500.
  const [timestampRaw, eventIdRaw] = cursor.split("|")
  if (eventIdRaw === undefined || !timestampRaw || !isStrictTimestamp(timestampRaw)) {
    throw new BadRequestException("Invalid sync cursor")
  }

  return { kind: "legacy", timestamp: timestampRaw, eventId: eventIdRaw ?? "", original: cursor }
}

export function buildSyncChangesCursor(xid8: string, seq: string): string {
  return `v2:${xid8}:${seq}`
}

export function extractAttachmentId(payload: Record<string, unknown> | null): string | null {
  if (!payload || typeof payload !== "object") {
    return null
  }
  const value = (payload as { attachment_id?: unknown }).attachment_id
  if (typeof value !== "string" || value.trim().length === 0) {
    return null
  }
  return value
}
