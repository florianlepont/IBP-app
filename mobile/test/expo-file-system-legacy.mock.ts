// In-memory double for "expo-file-system/legacy". Files are kept in a Map keyed
// by their full "file://" URI (size only; no real bytes), directories in a Set.
// Every exported function is a jest.fn() so a test can override its behaviour;
// __resetMockFileSystem() restores the in-memory state AND the default
// implementations, so tests never leak overrides into one another.
// Test helpers (__setMockFile, __getMockFile, __listMockFiles) must be imported
// by relative path (e.g. "../../test/expo-file-system-legacy.mock"), never from
// "expo-file-system/legacy" itself: the real module has no such exports.

export const documentDirectory = "file:///mock/documents/"
export const cacheDirectory = "file:///mock/cache/"

export enum FileSystemUploadType {
  BINARY_CONTENT = 0,
  MULTIPART = 1,
}

export type MockFileInfo = {
  exists: true
  isDirectory: boolean
  uri: string
  size: number
  modificationTime: number
}
export type MockFileMissing = { exists: false; isDirectory: false; uri: string }

interface MockFileRecord {
  size: number
}

let files = new Map<string, MockFileRecord>()
let directories = new Set<string>()
let uploadCounter = 0

function resetState(): void {
  files = new Map()
  directories = new Set([documentDirectory, cacheDirectory])
  uploadCounter = 0
}

function normalizeDir(uri: string): string {
  return uri.endsWith("/") ? uri : `${uri}/`
}

function isDirectoryUri(uri: string): boolean {
  return directories.has(uri) || directories.has(normalizeDir(uri))
}

export function __setMockFile(uri: string, size: number): void {
  files.set(uri, { size })
}

export function __getMockFile(uri: string): MockFileRecord | undefined {
  return files.get(uri)
}

export function __listMockFiles(): string[] {
  return Array.from(files.keys())
}

export const getInfoAsync = jest.fn()
export const copyAsync = jest.fn()
export const moveAsync = jest.fn()
export const makeDirectoryAsync = jest.fn()
export const deleteAsync = jest.fn()
export const readDirectoryAsync = jest.fn()
export const downloadAsync = jest.fn()
export const uploadAsync = jest.fn()
export const createUploadTask = jest.fn()

function defaultGetInfoAsync(fileUri: string): Promise<MockFileInfo | MockFileMissing> {
  if (isDirectoryUri(fileUri)) {
    return Promise.resolve({
      exists: true,
      isDirectory: true,
      uri: fileUri,
      size: 0,
      modificationTime: 0,
    })
  }
  const file = files.get(fileUri)
  if (!file) {
    return Promise.resolve({ exists: false, isDirectory: false, uri: fileUri })
  }
  return Promise.resolve({
    exists: true,
    isDirectory: false,
    uri: fileUri,
    size: file.size,
    modificationTime: 0,
  })
}

function defaultCopyAsync(options: { from: string; to: string }): Promise<void> {
  const source = files.get(options.from)
  if (!source) {
    return Promise.reject(new Error(`__mockFs: copyAsync source does not exist: ${options.from}`))
  }
  files.set(options.to, { size: source.size })
  return Promise.resolve()
}

function defaultMoveAsync(options: { from: string; to: string }): Promise<void> {
  const source = files.get(options.from)
  if (!source) {
    return Promise.reject(new Error(`__mockFs: moveAsync source does not exist: ${options.from}`))
  }
  files.set(options.to, { size: source.size })
  files.delete(options.from)
  return Promise.resolve()
}

function defaultMakeDirectoryAsync(fileUri: string): Promise<void> {
  directories.add(normalizeDir(fileUri))
  return Promise.resolve()
}

function defaultDeleteAsync(fileUri: string, options?: { idempotent?: boolean }): Promise<void> {
  if (isDirectoryUri(fileUri)) {
    const prefix = normalizeDir(fileUri)
    for (const key of Array.from(files.keys())) {
      if (key.startsWith(prefix)) {
        files.delete(key)
      }
    }
    directories.delete(prefix)
    directories.delete(fileUri)
    return Promise.resolve()
  }
  const existed = files.delete(fileUri)
  if (!existed && !options?.idempotent) {
    return Promise.reject(new Error(`__mockFs: deleteAsync target does not exist: ${fileUri}`))
  }
  return Promise.resolve()
}

function defaultReadDirectoryAsync(fileUri: string): Promise<string[]> {
  const prefix = normalizeDir(fileUri)
  const names: string[] = []
  for (const key of files.keys()) {
    if (key.startsWith(prefix)) {
      names.push(key.slice(prefix.length))
    }
  }
  return Promise.resolve(names)
}

function defaultDownloadAsync(
  _uri: string,
  fileUri: string,
): Promise<{
  status: number
  uri: string
  headers: Record<string, string>
  mimeType: string | null
}> {
  files.set(fileUri, { size: 1234 })
  return Promise.resolve({ status: 200, uri: fileUri, headers: {}, mimeType: "image/jpeg" })
}

function defaultUploadAsync(): Promise<{
  status: number
  body: string
  headers: Record<string, string>
}> {
  return Promise.resolve({ status: 200, body: "", headers: {} })
}

function defaultCreateUploadTask(): { uploadAsync: jest.Mock; cancelAsync: jest.Mock } {
  uploadCounter += 1
  return {
    uploadAsync: jest.fn(() => Promise.resolve({ status: 200, body: "", headers: {} })),
    cancelAsync: jest.fn(() => Promise.resolve()),
  }
}

export function __resetMockFileSystem(): void {
  resetState()
  getInfoAsync.mockReset().mockImplementation(defaultGetInfoAsync)
  copyAsync.mockReset().mockImplementation(defaultCopyAsync)
  moveAsync.mockReset().mockImplementation(defaultMoveAsync)
  makeDirectoryAsync.mockReset().mockImplementation(defaultMakeDirectoryAsync)
  deleteAsync.mockReset().mockImplementation(defaultDeleteAsync)
  readDirectoryAsync.mockReset().mockImplementation(defaultReadDirectoryAsync)
  downloadAsync.mockReset().mockImplementation(defaultDownloadAsync)
  uploadAsync.mockReset().mockImplementation(defaultUploadAsync)
  createUploadTask.mockReset().mockImplementation(defaultCreateUploadTask)
}

__resetMockFileSystem()
