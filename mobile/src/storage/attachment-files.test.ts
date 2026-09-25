import {
  __getMockFile,
  __resetMockFileSystem,
  __setMockFile,
} from "../../test/expo-file-system-legacy.mock"
import {
  ATTACHMENTS_SUBDIR,
  buildAttachmentFileUri,
  deleteAllAttachmentFiles,
  deleteAttachmentFile,
  ensureAttachmentsDir,
  extensionForMimeType,
  getAttachmentsDirUri,
  getLocalFileSize,
  isInAttachmentsDir,
  localFileExists,
  resolveAttachmentUri,
} from "./attachment-files"

const CURRENT_DIR = "file:///mock/documents/attachments/"
const OLD_CONTAINER_URI = "file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/attachments/x.jpg"
const CACHE_URI = "file:///mock/cache/imagepicker-123.jpg"

beforeEach(() => {
  __resetMockFileSystem()
})

describe("ATTACHMENTS_SUBDIR", () => {
  it("is 'attachments/'", () => {
    expect(ATTACHMENTS_SUBDIR).toBe("attachments/")
  })
})

describe("getAttachmentsDirUri / buildAttachmentFileUri", () => {
  it("returns the attachments directory under the current document directory", () => {
    expect(getAttachmentsDirUri()).toBe(CURRENT_DIR)
  })

  it("builds a file uri inside the attachments directory", () => {
    expect(buildAttachmentFileUri("a.jpg")).toBe(`${CURRENT_DIR}a.jpg`)
  })
})

describe("ensureAttachmentsDir", () => {
  it("creates the directory and is idempotent", async () => {
    await expect(ensureAttachmentsDir()).resolves.toBeUndefined()
    await expect(ensureAttachmentsDir()).resolves.toBeUndefined()
  })
})

describe("resolveAttachmentUri", () => {
  it("returns a uri already in the current attachments dir unchanged", () => {
    const uri = `${CURRENT_DIR}photo.jpg`
    expect(resolveAttachmentUri(uri)).toBe(uri)
  })

  it("returns a non-attachments-dir uri unchanged (e.g. an ImagePicker cache uri)", () => {
    expect(resolveAttachmentUri(CACHE_URI)).toBe(CACHE_URI)
  })

  it("re-bases an old-container attachments uri onto the current document directory", () => {
    expect(resolveAttachmentUri(OLD_CONTAINER_URI)).toBe(`${CURRENT_DIR}x.jpg`)
  })

  it("resolves an empty string to an empty string", () => {
    expect(resolveAttachmentUri("")).toBe("")
  })
})

describe("isInAttachmentsDir", () => {
  it("is true for a uri in the current attachments dir", () => {
    expect(isInAttachmentsDir(`${CURRENT_DIR}photo.jpg`)).toBe(true)
  })

  it("is true for an old-container attachments uri", () => {
    expect(isInAttachmentsDir(OLD_CONTAINER_URI)).toBe(true)
  })

  it("is false for a cache uri", () => {
    expect(isInAttachmentsDir(CACHE_URI)).toBe(false)
  })

  it("is false for an empty string", () => {
    expect(isInAttachmentsDir("")).toBe(false)
  })
})

describe("getLocalFileSize / localFileExists", () => {
  it("returns the size for an existing file", async () => {
    const uri = `${CURRENT_DIR}photo.jpg`
    __setMockFile(uri, 4321)
    await expect(getLocalFileSize(uri)).resolves.toBe(4321)
    await expect(localFileExists(uri)).resolves.toBe(true)
  })

  it("returns null for a missing file", async () => {
    const uri = `${CURRENT_DIR}missing.jpg`
    await expect(getLocalFileSize(uri)).resolves.toBeNull()
    await expect(localFileExists(uri)).resolves.toBe(false)
  })

  it("returns null for an empty uri", async () => {
    await expect(getLocalFileSize("")).resolves.toBeNull()
    await expect(localFileExists("")).resolves.toBe(false)
  })
})

describe("deleteAttachmentFile", () => {
  it("deletes a file inside the attachments dir", async () => {
    const uri = `${CURRENT_DIR}photo.jpg`
    __setMockFile(uri, 100)
    await deleteAttachmentFile(uri)
    expect(__getMockFile(uri)).toBeUndefined()
  })

  it("is a no-op for a missing file", async () => {
    const uri = `${CURRENT_DIR}missing.jpg`
    await expect(deleteAttachmentFile(uri)).resolves.toBeUndefined()
  })

  it("refuses to delete a uri outside the attachments dir", async () => {
    __setMockFile(CACHE_URI, 100)
    await deleteAttachmentFile(CACHE_URI)
    expect(__getMockFile(CACHE_URI)).toEqual({ size: 100 })
  })
})

describe("deleteAllAttachmentFiles", () => {
  it("removes every file under the attachments dir and leaves cache files alone", async () => {
    const attachmentUri = `${CURRENT_DIR}photo.jpg`
    const cacheUri = "file:///mock/cache/kept.jpg"
    __setMockFile(attachmentUri, 100)
    __setMockFile(cacheUri, 200)

    await deleteAllAttachmentFiles()

    expect(__getMockFile(attachmentUri)).toBeUndefined()
    expect(__getMockFile(cacheUri)).toEqual({ size: 200 })
  })
})

describe("extensionForMimeType", () => {
  it.each([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/heic", "heic"],
    ["image/webp", "webp"],
    ["image/unknown-format", "jpg"],
  ])("%s -> %s", (mimeType, expected) => {
    expect(extensionForMimeType(mimeType)).toBe(expected)
  })
})
