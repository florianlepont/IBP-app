import * as FileSystem from "expo-file-system/legacy"

// Single owner of photo file paths (D-12): every module that captures,
// uploads, downloads or purges an attachment photo goes through the helpers
// here instead of building "documentDirectory + attachments/..." paths
// itself. This is what protects durable photos against the iOS container
// path changing after an app update (D-09).
export const ATTACHMENTS_SUBDIR = "attachments/"

const OLD_CONTAINER_ATTACHMENT_PATTERN = /\/attachments\/([^/]+)$/

export function getAttachmentsDirUri(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error("attachment-files: FileSystem.documentDirectory is null")
  }
  return `${FileSystem.documentDirectory}${ATTACHMENTS_SUBDIR}`
}

export function buildAttachmentFileUri(fileName: string): string {
  return `${getAttachmentsDirUri()}${fileName}`
}

export async function ensureAttachmentsDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(getAttachmentsDirUri(), { intermediates: true })
}

export function isInAttachmentsDir(uri: string): boolean {
  if (!uri) {
    return false
  }
  if (uri.startsWith(getAttachmentsDirUri())) {
    return true
  }
  return uri.startsWith("file://") && OLD_CONTAINER_ATTACHMENT_PATTERN.test(uri)
}

// Rebases a stored attachments-dir uri onto the current document directory.
// iOS reassigns the app container UUID on every install/update, so a uri
// persisted in an earlier session can point at a path that no longer exists.
// Anything that is not an attachments-dir path (a cache uri from the image
// picker, a remote placeholder, etc.) is returned unchanged.
export function resolveAttachmentUri(uri: string): string {
  if (!uri) {
    return ""
  }
  const currentDir = getAttachmentsDirUri()
  if (uri.startsWith(currentDir)) {
    return uri
  }
  const match = uri.match(OLD_CONTAINER_ATTACHMENT_PATTERN)
  if (match) {
    return `${currentDir}${match[1]}`
  }
  return uri
}

export async function getLocalFileSize(uri: string): Promise<number | null> {
  if (!uri) {
    return null
  }
  try {
    const info = await FileSystem.getInfoAsync(resolveAttachmentUri(uri))
    if (!info.exists) {
      return null
    }
    return info.size
  } catch {
    return null
  }
}

export async function localFileExists(uri: string): Promise<boolean> {
  return (await getLocalFileSize(uri)) !== null
}

export async function deleteAttachmentFile(uri: string): Promise<void> {
  if (!uri) {
    return
  }
  const resolved = resolveAttachmentUri(uri)
  if (!isInAttachmentsDir(resolved)) {
    return
  }
  await FileSystem.deleteAsync(resolved, { idempotent: true })
}

export async function deleteAllAttachmentFiles(): Promise<void> {
  await FileSystem.deleteAsync(getAttachmentsDirUri(), { idempotent: true })
}

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/webp": "webp",
}

export function extensionForMimeType(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] ?? "jpg"
}
