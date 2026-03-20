export type PublicMapDbRow = {
  id: string
  region_version: string | null
  scores: Record<string, unknown>
  submitted_at: string | null
  parcel_centroid_lat?: number | null
  parcel_centroid_lng?: number | null
}

export type PublicMapItem = {
  survey_id: string
  display_location: { lat: number; lng: number }
  survey_date: string
  region_code: string
  ibp_total: number
}

export function normalizeDateInput(value: string | undefined): string | null {
  if (!value || typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null
  }
  return trimmed
}

export function toPublicMapItem(row: PublicMapDbRow): PublicMapItem | null {
  const lat = asFiniteNumber(row.parcel_centroid_lat)
  const lng = asFiniteNumber(row.parcel_centroid_lng)
  if (lat === null || lng === null) {
    return null
  }

  const ibpTotal = asFiniteNumber(row.scores?.ibp_total) ?? 0
  const surveyDate =
    typeof row.submitted_at === "string" && row.submitted_at.length >= 10
      ? row.submitted_at.slice(0, 10)
      : new Date().toISOString().slice(0, 10)

  return {
    survey_id: row.id,
    display_location: {
      lat: Number(lat.toFixed(2)),
      lng: Number(lng.toFixed(2)),
    },
    survey_date: surveyDate,
    region_code: row.region_version ?? "unknown",
    ibp_total: ibpTotal,
  }
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}
