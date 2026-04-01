import { BadRequestException } from "@nestjs/common"
import { SurveyPatchBody, SurveyRow } from "./surveys.types"

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

export function parseChangesCursor(cursor?: string): {
  timestamp: string
  eventId: string
  original: string | null
} {
  if (!cursor || cursor.trim().length === 0) {
    return {
      timestamp: "1970-01-01T00:00:00.000Z",
      eventId: "",
      original: null,
    }
  }

  const [timestampRaw, eventIdRaw] = cursor.split("|")
  if (!timestampRaw || Number.isNaN(Date.parse(timestampRaw))) {
    throw new BadRequestException("Invalid sync cursor")
  }

  return {
    timestamp: timestampRaw,
    eventId: eventIdRaw ?? "",
    original: cursor,
  }
}

export function buildChangesCursor(timestamp: string, eventId: string): string {
  return `${timestamp}|${eventId}`
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
