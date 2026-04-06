import { FactorKey } from "../app/types"

const FACTOR_ORDER: FactorKey[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
const FACTOR_KEYS = new Set<FactorKey>(FACTOR_ORDER)

export const isFactorKey = (value: string): value is FactorKey =>
  FACTOR_KEYS.has(value as FactorKey)

export const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

export const resolveDisplayCoordinates = (
  displayLocation?: { lat?: unknown; lng?: unknown } | null,
): { lat: number; lng: number } | null => {
  if (!displayLocation) return null

  const lat = asFiniteNumber(displayLocation.lat)
  const lng = asFiniteNumber(displayLocation.lng)

  if (lat === null || lng === null) return null

  return { lat, lng }
}

export const toAddressLabel = (item: Record<string, unknown>): string => {
  const streetNumber = typeof item.streetNumber === "string" ? item.streetNumber.trim() : ""
  const street = typeof item.street === "string" ? item.street.trim() : ""
  const postalCode = typeof item.postalCode === "string" ? item.postalCode.trim() : ""
  const city = typeof item.city === "string" ? item.city.trim() : ""
  const region = typeof item.region === "string" ? item.region.trim() : ""
  const country = typeof item.country === "string" ? item.country.trim() : ""

  const line1 = [streetNumber, street].filter((part) => part.length > 0).join(" ")
  const line2 = [postalCode, city].filter((part) => part.length > 0).join(" ")
  const line3 = [region, country].filter((part) => part.length > 0).join(", ")

  return [line1, line2, line3].filter((part) => part.length > 0).join(" - ")
}
