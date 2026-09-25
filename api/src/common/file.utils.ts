const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/heic": ".heic",
  "image/webp": ".webp",
}

// D-09/D-16: both helpers use an own-property lookup, so prototype keys such as
// "constructor" or "__proto__" never pass the allow-list. Object.hasOwn is not available
// with the ES2021 target.

// Callers must check isAllowedMimeType first and answer 400; this throws for unknown types.
export function extensionFromMime(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, normalized)) {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }
  return ALLOWED_MIME_TYPES[normalized] as string
}

export function isAllowedMimeType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, mimeType.trim().toLowerCase())
}
