import { FactorKey } from "../app/types"
import { fr } from "../i18n"
import { resolveAttachmentUri } from "../storage/attachment-files"
import type { LocalAttachment } from "../storage/types"

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

// Preview-state helper (D-10, D-11): decides which of the four attachment
// preview states a screen should render, from `file_state` alone. Screens
// are not rendered in Jest, so all of this logic lives here where it is
// unit-tested, instead of inline in SurveyDetailScreen/SurveyListScreen.
export const MISSING_PHOTO_MESSAGE: string = fr.labels.attachmentPreview.missing
export const LOADING_PHOTO_MESSAGE: string = fr.labels.attachmentPreview.loading
export const UNAVAILABLE_PHOTO_MESSAGE: string = fr.labels.attachmentPreview.unavailable

export type AttachmentPreview =
  | { kind: "image"; uri: string }
  | { kind: "loading"; message: string }
  | { kind: "missing"; message: string }
  | { kind: "unavailable"; message: string }

export const isPhotoAttachment = (attachment: Pick<LocalAttachment, "mime_type">): boolean =>
  attachment.mime_type.startsWith("image/")

export const resolveAttachmentPreview = (
  attachment: Pick<LocalAttachment, "file_state" | "local_uri">,
): AttachmentPreview => {
  if (attachment.file_state === "missing") {
    return { kind: "missing", message: MISSING_PHOTO_MESSAGE }
  }
  if (attachment.file_state === "unavailable") {
    return { kind: "unavailable", message: UNAVAILABLE_PHOTO_MESSAGE }
  }
  if (attachment.file_state === "remote") {
    return { kind: "loading", message: LOADING_PHOTO_MESSAGE }
  }
  // file_state === "local"
  const uri = attachment.local_uri?.trim() ?? ""
  if (!uri) {
    return { kind: "loading", message: LOADING_PHOTO_MESSAGE }
  }
  return { kind: "image", uri: resolveAttachmentUri(uri) }
}

export const selectPreviewCandidates = (attachments: LocalAttachment[]): LocalAttachment[] =>
  attachments.filter(
    (attachment) =>
      isPhotoAttachment(attachment) &&
      (attachment.file_state === "remote" || attachment.file_state === "local"),
  )

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
