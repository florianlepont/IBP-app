import {
  __resetMockFileSystem,
  __getMockFile,
  __listMockFiles,
  __setMockFile,
  createUploadTask,
  getInfoAsync,
  FileSystemUploadType,
} from "../../test/expo-file-system-legacy.mock"
import { __setMockImageSize, ImageManipulator } from "../../test/expo-image-manipulator.mock"
import {
  computeResizeTarget,
  LocalFileMissingError,
  MAX_PHOTO_EDGE_PX,
  PHOTO_JPEG_QUALITY,
  preparePhotoForStorage,
  uploadAttachmentFile,
  UPLOAD_TIMEOUT_MS,
  UploadTimeoutError,
} from "./attachments"

beforeEach(() => {
  __resetMockFileSystem()
  __setMockImageSize(4032, 3024)
  jest.clearAllMocks()
})

describe("computeResizeTarget", () => {
  it("resizes a landscape photo on its width", () => {
    expect(computeResizeTarget(4032, 3024)).toEqual({ width: 2048 })
  })

  it("resizes a portrait photo on its height", () => {
    expect(computeResizeTarget(3024, 4032)).toEqual({ height: 2048 })
  })

  it("returns null when the long edge equals the max (no resize)", () => {
    expect(computeResizeTarget(2048, 1536)).toBeNull()
  })

  it("never upscales a small photo", () => {
    expect(computeResizeTarget(1000, 800)).toBeNull()
  })

  it("resizes a square photo whose edge exceeds the max, on width", () => {
    expect(computeResizeTarget(4000, 4000)).toEqual({ width: 2048 })
  })

  it.each([
    [0, 0],
    [NaN, 100],
    [100, NaN],
  ])("returns null for invalid dimensions (%p, %p)", (width, height) => {
    expect(computeResizeTarget(width, height)).toBeNull()
  })

  it("respects a custom maxEdge", () => {
    expect(computeResizeTarget(2000, 1000, 1024)).toEqual({ width: 1024 })
  })
})

describe("preparePhotoForStorage", () => {
  it("resizes on the longer axis, re-encodes to JPEG 0.7, and persists durably", async () => {
    __setMockImageSize(3024, 4032)

    const result = await preparePhotoForStorage({
      uri: "file:///mock/cache/imagepicker/x.heic",
      width: 3024,
      height: 4032,
      mimeType: "image/heic",
    })

    expect(ImageManipulator.manipulate).toHaveBeenCalledWith(
      "file:///mock/cache/imagepicker/x.heic",
    )
    const context = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value
    expect(context.resize).toHaveBeenCalledWith({ height: 2048 })
    expect(context.renderAsync).toHaveBeenCalled()

    expect(result.uri).toMatch(/^file:\/\/\/mock\/documents\/attachments\/.+\.jpg$/)
    expect(result.mimeType).toBe("image/jpeg")
    expect(result.sizeBytes).toBe(__getMockFile(result.uri)?.size)
    expect(typeof result.width).toBe("number")
    expect(typeof result.height).toBe("number")

    // The manipulator's temp cache file was cleaned up.
    expect(__listMockFiles().some((uri) => uri.includes("manipulated-"))).toBe(false)
  })

  it("does not resize a photo smaller than the max edge, but still re-encodes and persists it", async () => {
    __setMockImageSize(1000, 800)

    const result = await preparePhotoForStorage({
      uri: "file:///mock/cache/imagepicker/small.jpg",
      width: 1000,
      height: 800,
      mimeType: "image/jpeg",
    })

    const context = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value
    expect(context.resize).not.toHaveBeenCalled()
    expect(context.renderAsync).toHaveBeenCalledTimes(1)
    expect(result.mimeType).toBe("image/jpeg")
    expect(result.uri).toMatch(/\.jpg$/)
  })

  it("renders once to discover unknown dimensions, then decides the resize", async () => {
    __setMockImageSize(4032, 3024)

    const result = await preparePhotoForStorage({
      uri: "file:///mock/cache/imagepicker/unknown.jpg",
      mimeType: "image/jpeg",
    })

    const context = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value
    expect(context.renderAsync).toHaveBeenCalledTimes(2)
    expect(context.resize).toHaveBeenCalledWith({ width: 2048 })
    expect(result.mimeType).toBe("image/jpeg")
  })

  it("renders once and skips resize when the unknown-dimension probe is already small enough", async () => {
    __setMockImageSize(1000, 800)

    await preparePhotoForStorage({
      uri: "file:///mock/cache/imagepicker/unknown-small.jpg",
      mimeType: "image/jpeg",
    })

    const context = (ImageManipulator.manipulate as jest.Mock).mock.results[0].value
    expect(context.renderAsync).toHaveBeenCalledTimes(1)
    expect(context.resize).not.toHaveBeenCalled()
  })

  it("throws when the persisted file cannot be sized", async () => {
    ;(getInfoAsync as jest.Mock).mockResolvedValueOnce({
      exists: false,
      isDirectory: false,
      uri: "unused",
    })

    await expect(
      preparePhotoForStorage({
        uri: "file:///mock/cache/imagepicker/x.jpg",
        width: 1000,
        height: 800,
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow(/could not size persisted file/)
  })
})

describe("uploadAttachmentFile", () => {
  const LOCAL_URI = "file:///mock/documents/attachments/photo.jpg"

  beforeEach(() => {
    __setMockImageSize(4032, 3024)
  })

  it("streams via createUploadTask with MULTIPART and a bearer token for the API upload route", async () => {
    __setMockFile(LOCAL_URI, 100)

    const result = await uploadAttachmentFile({
      uploadTarget: "http://api.local/v1/surveys/s1/attachments/a1/upload?token=tok",
      isApiUploadTarget: true,
      localUri: LOCAL_URI,
      mimeType: "image/jpeg",
      accessToken: "tok",
    })

    expect(createUploadTask).toHaveBeenCalledWith(
      "http://api.local/v1/surveys/s1/attachments/a1/upload?token=tok",
      LOCAL_URI,
      {
        httpMethod: "PUT",
        uploadType: FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType: "image/jpeg",
        headers: { Authorization: "Bearer tok" },
      },
    )
    expect(result).toEqual({ status: 200 })
  })

  it("streams via createUploadTask with BINARY_CONTENT and no Authorization for a presigned target", async () => {
    __setMockFile(LOCAL_URI, 100)

    await uploadAttachmentFile({
      uploadTarget: "https://minio.local/bucket/key?signature=abc",
      isApiUploadTarget: false,
      localUri: LOCAL_URI,
      mimeType: "image/jpeg",
      accessToken: "tok",
    })

    const callOptions = (createUploadTask as jest.Mock).mock.calls[0][2]
    expect(callOptions.uploadType).toBe(FileSystemUploadType.BINARY_CONTENT)
    expect(callOptions.headers).toEqual({ "Content-Type": "image/jpeg" })
    expect(callOptions.headers.Authorization).toBeUndefined()
  })

  it("rejects with LocalFileMissingError and never calls createUploadTask when the file is missing", async () => {
    await expect(
      uploadAttachmentFile({
        uploadTarget: "https://minio.local/bucket/key",
        isApiUploadTarget: false,
        localUri: "file:///mock/documents/attachments/missing.jpg",
        mimeType: "image/jpeg",
        accessToken: "tok",
      }),
    ).rejects.toBeInstanceOf(LocalFileMissingError)

    expect(createUploadTask).not.toHaveBeenCalled()
  })

  it("cancels and rejects with UploadTimeoutError when uploadAsync never settles", async () => {
    __setMockFile(LOCAL_URI, 100)

    const cancelAsync = jest.fn().mockResolvedValue(undefined)
    ;(createUploadTask as jest.Mock).mockReturnValueOnce({
      uploadAsync: jest.fn(() => new Promise(() => {})),
      cancelAsync,
    })

    jest.useFakeTimers()
    try {
      const promise = uploadAttachmentFile({
        uploadTarget: "https://minio.local/bucket/key",
        isApiUploadTarget: false,
        localUri: LOCAL_URI,
        mimeType: "image/jpeg",
        accessToken: "tok",
      })
      const assertion = expect(promise).rejects.toBeInstanceOf(UploadTimeoutError)

      await jest.advanceTimersByTimeAsync(UPLOAD_TIMEOUT_MS)
      await assertion
      expect(cancelAsync).toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })

  it("rejects with UploadTimeoutError when uploadAsync resolves null (cancelled)", async () => {
    __setMockFile(LOCAL_URI, 100)
    ;(createUploadTask as jest.Mock).mockReturnValueOnce({
      uploadAsync: jest.fn().mockResolvedValue(null),
      cancelAsync: jest.fn().mockResolvedValue(undefined),
    })

    await expect(
      uploadAttachmentFile({
        uploadTarget: "https://minio.local/bucket/key",
        isApiUploadTarget: false,
        localUri: LOCAL_URI,
        mimeType: "image/jpeg",
        accessToken: "tok",
      }),
    ).rejects.toBeInstanceOf(UploadTimeoutError)
  })
})

describe("constants", () => {
  it("exposes the resize edge, jpeg quality and upload timeout", () => {
    expect(MAX_PHOTO_EDGE_PX).toBe(2048)
    expect(PHOTO_JPEG_QUALITY).toBe(0.7)
    expect(UPLOAD_TIMEOUT_MS).toBe(120_000)
  })
})
