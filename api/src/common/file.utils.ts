export function extensionFromMime(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase()
  if (normalized === "image/jpeg" || normalized === "image/jpg") return ".jpg"
  if (normalized === "image/png") return ".png"
  if (normalized === "image/heic") return ".heic"
  if (normalized === "image/webp") return ".webp"
  return ".bin"
}
