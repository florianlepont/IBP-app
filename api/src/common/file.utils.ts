const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/heic": ".heic",
  "image/webp": ".webp",
}

export function extensionFromMime(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase()
  const ext = ALLOWED_MIME_TYPES[normalized]
  if (!ext) throw new Error(`Unsupported file type: ${mimeType}`)
  return ext
}

export function isAllowedMimeType(mimeType: string): boolean {
  return mimeType.trim().toLowerCase() in ALLOWED_MIME_TYPES
}
