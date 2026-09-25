import { BadRequestException } from "@nestjs/common"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises"
import { resolve, sep } from "path"
import { DOWNLOAD_URL_TTL_SECONDS, StorageService } from "../src/storage/storage.service"
import { StorageModule } from "../src/storage/storage.module"

jest.mock("fs/promises", () => {
  const actual = jest.requireActual("fs/promises")
  return {
    ...actual,
    mkdir: jest.fn(),
    readFile: jest.fn(),
    rm: jest.fn(),
    stat: jest.fn(),
    writeFile: jest.fn(),
  }
})

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}))

const mockS3Send = jest.fn()

jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3")
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  }
})

const mockGetSignedUrl = getSignedUrl as jest.Mock
const mockMkdir = mkdir as jest.Mock
const mockReadFile = readFile as jest.Mock
const mockRm = rm as jest.Mock
const mockStat = stat as jest.Mock
const mockWriteFile = writeFile as jest.Mock
const MockS3Client = S3Client as unknown as jest.Mock

const UPLOAD_ROOT = "/tmp/ibp-uploads-storage-test"
const ROOT = resolve(UPLOAD_ROOT)
const USER_ID = "3f1c2b7e-8a4d-4c1e-9b2a-0d5e6f7a8b9c"
const ATTACHMENT_ID = "0b9f7c1e-2d3a-4e5f-8a6b-7c8d9e0f1a2b"

function enoent(): NodeJS.ErrnoException {
  const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException
  err.code = "ENOENT"
  return err
}

function buildService(
  mode: "local" | "minio",
  env: Record<string, string | undefined> = {},
): StorageService {
  const keys = ["OBJECT_STORAGE_MODE", "ATTACHMENTS_UPLOAD_DIR", "OBJECT_STORAGE_BUCKET"]
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  process.env.OBJECT_STORAGE_MODE = mode
  process.env.ATTACHMENTS_UPLOAD_DIR = UPLOAD_ROOT
  delete process.env.OBJECT_STORAGE_BUCKET
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  const service = new StorageService()

  for (const key of keys) {
    const value = previous[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return service
}

function sentCommands(): unknown[] {
  return mockS3Send.mock.calls.map((call) => call[0])
}

describe("StorageService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockS3Send.mockResolvedValue({})
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
    mockRm.mockResolvedValue(undefined)
  })

  describe("configuration", () => {
    it("defaults to local mode when OBJECT_STORAGE_MODE is not minio", () => {
      expect(buildService("local").mode).toBe("local")
      expect(buildService("bogus" as "local").mode).toBe("local")
      expect(MockS3Client).not.toHaveBeenCalled()
    })

    it("minio: builds exactly one S3 client per instance", async () => {
      const service = buildService("minio")
      expect(service.mode).toBe("minio")
      expect(MockS3Client).toHaveBeenCalledTimes(1)
      expect(MockS3Client.mock.calls[0][0]).toMatchObject({ forcePathStyle: true })

      await service.putObject("surveys/s/a.jpg", Buffer.from("x"), "image/jpeg")
      await service.headObject("surveys/s/a.jpg")
      expect(MockS3Client).toHaveBeenCalledTimes(1)
    })

    it("minio: bucket defaults to ibp-media when OBJECT_STORAGE_BUCKET is unset", async () => {
      const service = buildService("minio")
      await service.putObject("surveys/s/a.jpg", Buffer.from("x"), "image/jpeg")
      const put = sentCommands().find((cmd) => cmd instanceof PutObjectCommand) as PutObjectCommand
      expect(put.input.Bucket).toBe("ibp-media")
    })

    it("minio: honours OBJECT_STORAGE_BUCKET", async () => {
      const service = buildService("minio", { OBJECT_STORAGE_BUCKET: "cortege-media" })
      await service.putObject("surveys/s/a.jpg", Buffer.from("x"), "image/jpeg")
      const put = sentCommands().find((cmd) => cmd instanceof PutObjectCommand) as PutObjectCommand
      expect(put.input.Bucket).toBe("cortege-media")
    })
  })

  describe("resolveLocalPath (D-07, D-14)", () => {
    it("resolves a key under the upload root", () => {
      const service = buildService("local")
      const path = service.resolveLocalPath("surveys/abc/def.jpg")
      expect(path.startsWith(ROOT + sep)).toBe(true)
      expect(path).toBe(resolve(ROOT, "surveys/abc/def.jpg"))
    })

    it.each(["../../etc/passwd", "/etc/passwd", "surveys/../../x"])(
      "rejects the escaping key %p",
      (key) => {
        const service = buildService("local")
        expect(() => service.resolveLocalPath(key)).toThrow(BadRequestException)
      },
    )
  })

  describe("key builders (D-14)", () => {
    it("builds the attachment key in the existing format", () => {
      const service = buildService("local")
      expect(service.buildAttachmentKey("survey-1", ATTACHMENT_ID, "image/jpeg")).toBe(
        `surveys/survey-1/${ATTACHMENT_ID}.jpg`,
      )
    })

    it.each([
      ["../x", ATTACHMENT_ID],
      ["a/b", ATTACHMENT_ID],
      ["survey-1", "../y"],
      ["", ATTACHMENT_ID],
      ["survey-1", "a.b"],
    ])("rejects unsafe attachment key segments %p / %p", (surveyId, attachmentId) => {
      const service = buildService("local")
      expect(() => service.buildAttachmentKey(surveyId, attachmentId, "image/jpeg")).toThrow(
        BadRequestException,
      )
    })

    it("rejects an attachment key with an unsupported MIME type", () => {
      const service = buildService("local")
      expect(() => service.buildAttachmentKey("survey-1", ATTACHMENT_ID, "text/plain")).toThrow(
        BadRequestException,
      )
    })

    it("builds the profile picture key in the existing format", () => {
      const service = buildService("local")
      expect(service.buildProfilePictureKey(USER_ID, "image/png")).toBe(
        `profiles/${USER_ID}/avatar.png`,
      )
    })

    it.each(["image/gif", "constructor", "__proto__"])(
      "rejects the profile picture MIME %p with a BadRequestException",
      (mime) => {
        const service = buildService("local")
        expect(() => service.buildProfilePictureKey(USER_ID, mime)).toThrow(BadRequestException)
      },
    )

    it("rejects an unsafe user id", () => {
      const service = buildService("local")
      expect(() => service.buildProfilePictureKey("../admin", "image/png")).toThrow(
        BadRequestException,
      )
    })
  })

  describe("key checks on keyed calls", () => {
    it.each(["", "a\u0000b", "/etc/passwd"])("rejects the key %p in minio mode", async (key) => {
      const service = buildService("minio")
      await expect(service.getObject(key)).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.headObject(key)).rejects.toBeInstanceOf(BadRequestException)
      expect(mockS3Send).not.toHaveBeenCalled()
    })

    it("rejects an escaping key in local mode before touching the filesystem", async () => {
      const service = buildService("local")
      await expect(
        service.putObject("../../etc/passwd", Buffer.from("x"), "image/jpeg"),
      ).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.getObject("surveys/../../x")).rejects.toBeInstanceOf(BadRequestException)
      expect(mockWriteFile).not.toHaveBeenCalled()
      expect(mockReadFile).not.toHaveBeenCalled()
    })
  })

  describe("presignPut (D-08)", () => {
    it("minio: signs ContentLength and ContentType on the PutObjectCommand", async () => {
      const service = buildService("minio")
      mockGetSignedUrl.mockResolvedValue("https://minio.local/signed-put")

      const url = await service.presignPut("surveys/s/a.jpg", "image/jpeg", 1234)

      expect(url).toBe("https://minio.local/signed-put")
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1)
      const [, command, options] = mockGetSignedUrl.mock.calls[0]
      expect(command).toBeInstanceOf(PutObjectCommand)
      expect(command.input.ContentLength).toBe(1234)
      expect(command.input.ContentType).toBe("image/jpeg")
      expect(command.input.Key).toBe("surveys/s/a.jpg")
      expect(command.input.Bucket).toBe("ibp-media")
      expect(options).toEqual({ expiresIn: 15 * 60 })
    })

    it.each([-1, 1.5, Number.NaN])("minio: rejects the declared size %p", async (size) => {
      const service = buildService("minio")
      await expect(
        service.presignPut("surveys/s/a.jpg", "image/jpeg", size),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })

    it("local: rejects", async () => {
      const service = buildService("local")
      await expect(service.presignPut("surveys/s/a.jpg", "image/jpeg", 1234)).rejects.toThrow()
      expect(mockGetSignedUrl).not.toHaveBeenCalled()
    })
  })

  describe("presignGet", () => {
    it("minio: presigns a GetObjectCommand with the download TTL", async () => {
      const service = buildService("minio")
      mockGetSignedUrl.mockResolvedValue("https://minio.local/signed-get")

      const url = await service.presignGet("surveys/s/a.jpg")

      expect(url).toBe("https://minio.local/signed-get")
      const [, command, options] = mockGetSignedUrl.mock.calls[0]
      expect(command).toBeInstanceOf(GetObjectCommand)
      expect(command.input.Key).toBe("surveys/s/a.jpg")
      expect(options).toEqual({ expiresIn: DOWNLOAD_URL_TTL_SECONDS })
      expect(DOWNLOAD_URL_TTL_SECONDS).toBe(300)
    })

    it("local: rejects", async () => {
      const service = buildService("local")
      await expect(service.presignGet("surveys/s/a.jpg")).rejects.toThrow()
    })
  })

  describe("ensureBucket", () => {
    it("minio: creates the bucket once when HeadBucket fails, then reuses it", async () => {
      const service = buildService("minio")
      mockS3Send.mockImplementation(async (cmd: { constructor: { name: string } }) => {
        if (cmd.constructor.name === "HeadBucketCommand") throw { name: "NotFound" }
        return {}
      })

      await service.putObject("surveys/s/a.jpg", Buffer.from("x"), "image/jpeg")
      await service.putObject("surveys/s/b.jpg", Buffer.from("x"), "image/jpeg")

      const names = sentCommands().map((cmd) => (cmd as object).constructor.name)
      expect(names).toEqual([
        "HeadBucketCommand",
        "CreateBucketCommand",
        "PutObjectCommand",
        "PutObjectCommand",
      ])
    })

    it("minio: re-checks the bucket when a concurrent create fails", async () => {
      const service = buildService("minio")
      let headCalls = 0
      mockS3Send.mockImplementation(async (cmd: { constructor: { name: string } }) => {
        if (cmd.constructor.name === "HeadBucketCommand") {
          headCalls += 1
          if (headCalls === 1) throw { name: "NotFound" }
          return {}
        }
        if (cmd.constructor.name === "CreateBucketCommand")
          throw { name: "BucketAlreadyOwnedByYou" }
        return {}
      })

      await service.putObject("surveys/s/a.jpg", Buffer.from("x"), "image/jpeg")
      expect(headCalls).toBe(2)
    })
  })

  describe("putObject", () => {
    it("minio: sends a PutObjectCommand with body and content type", async () => {
      const service = buildService("minio")
      const body = Buffer.from("bytes")
      await service.putObject("profiles/u/avatar.png", body, "image/png")

      const put = sentCommands().find((cmd) => cmd instanceof PutObjectCommand) as PutObjectCommand
      expect(put.input).toMatchObject({
        Bucket: "ibp-media",
        Key: "profiles/u/avatar.png",
        Body: body,
        ContentType: "image/png",
      })
    })

    it("local: creates the parent directory and writes under the root", async () => {
      const service = buildService("local")
      const body = Buffer.from("bytes")
      await service.putObject("profiles/u/avatar.png", body, "image/png")

      const target = resolve(ROOT, "profiles/u/avatar.png")
      expect(mockMkdir).toHaveBeenCalledWith(resolve(ROOT, "profiles/u"), { recursive: true })
      expect(mockWriteFile).toHaveBeenCalledWith(target, body)
    })
  })

  describe("headObject", () => {
    it("minio: returns the content length", async () => {
      const service = buildService("minio")
      mockS3Send.mockResolvedValue({ ContentLength: 42 })
      await expect(service.headObject("surveys/s/a.jpg")).resolves.toEqual({ contentLength: 42 })
    })

    it.each([{ name: "NotFound" }, { name: "NoSuchKey" }, { $metadata: { httpStatusCode: 404 } }])(
      "minio: returns null when the object is missing (%p)",
      async (error) => {
        const service = buildService("minio")
        mockS3Send.mockImplementation(async (cmd: object) => {
          if (cmd.constructor.name === "HeadObjectCommand") throw error
          return {}
        })
        await expect(service.headObject("surveys/s/a.jpg")).resolves.toBeNull()
      },
    )

    it("minio: propagates other errors", async () => {
      const service = buildService("minio")
      const failure = Object.assign(new Error("denied"), {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
      })
      mockS3Send.mockImplementation(async (cmd: object) => {
        if (cmd.constructor.name === "HeadObjectCommand") throw failure
        return {}
      })
      await expect(service.headObject("surveys/s/a.jpg")).rejects.toBe(failure)
    })

    it("local: returns the file size from stat", async () => {
      const service = buildService("local")
      mockStat.mockResolvedValue({ size: 7 })
      await expect(service.headObject("surveys/s/a.jpg")).resolves.toEqual({ contentLength: 7 })
      expect(mockStat).toHaveBeenCalledWith(resolve(ROOT, "surveys/s/a.jpg"))
    })

    it("local: returns null on ENOENT and propagates other errors", async () => {
      const service = buildService("local")
      mockStat.mockRejectedValueOnce(enoent())
      await expect(service.headObject("surveys/s/a.jpg")).resolves.toBeNull()

      const failure = Object.assign(new Error("EACCES"), { code: "EACCES" })
      mockStat.mockRejectedValueOnce(failure)
      await expect(service.headObject("surveys/s/a.jpg")).rejects.toBe(failure)
    })
  })

  describe("getObject (D-15)", () => {
    it("minio: returns a Buffer from Body.transformToByteArray()", async () => {
      const service = buildService("minio")
      mockS3Send.mockImplementation(async (cmd: object) => {
        if (cmd.constructor.name === "GetObjectCommand") {
          return { Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } }
        }
        return {}
      })

      const result = await service.getObject("profiles/u/avatar.png")

      expect(Buffer.isBuffer(result)).toBe(true)
      expect(result).toEqual(Buffer.from([1, 2, 3]))
    })

    it("minio: returns null when the response has no body", async () => {
      const service = buildService("minio")
      await expect(service.getObject("profiles/u/avatar.png")).resolves.toBeNull()
    })

    it.each([{ name: "NoSuchKey" }, { name: "NotFound" }])(
      "minio: returns null on %p",
      async (error) => {
        const service = buildService("minio")
        mockS3Send.mockImplementation(async (cmd: object) => {
          if (cmd.constructor.name === "GetObjectCommand") throw error
          return {}
        })
        await expect(service.getObject("profiles/u/avatar.png")).resolves.toBeNull()
      },
    )

    it("minio: propagates other errors", async () => {
      const service = buildService("minio")
      const failure = Object.assign(new Error("boom"), { name: "InternalError" })
      mockS3Send.mockImplementation(async (cmd: object) => {
        if (cmd.constructor.name === "GetObjectCommand") throw failure
        return {}
      })
      await expect(service.getObject("profiles/u/avatar.png")).rejects.toBe(failure)
    })

    it("local: reads the file under the root", async () => {
      const service = buildService("local")
      mockReadFile.mockResolvedValue(Buffer.from("img"))
      await expect(service.getObject("profiles/u/avatar.png")).resolves.toEqual(Buffer.from("img"))
      expect(mockReadFile).toHaveBeenCalledWith(resolve(ROOT, "profiles/u/avatar.png"))
    })

    it("local: returns null on ENOENT and propagates other errors", async () => {
      const service = buildService("local")
      mockReadFile.mockRejectedValueOnce(enoent())
      await expect(service.getObject("profiles/u/avatar.png")).resolves.toBeNull()

      const failure = Object.assign(new Error("EISDIR"), { code: "EISDIR" })
      mockReadFile.mockRejectedValueOnce(failure)
      await expect(service.getObject("profiles/u/avatar.png")).rejects.toBe(failure)
    })
  })

  describe("deleteObject (best-effort)", () => {
    it("minio: sends a DeleteObjectCommand", async () => {
      const service = buildService("minio")
      await service.deleteObject("surveys/s/a.jpg")
      const names = sentCommands().map((cmd) => (cmd as object).constructor.name)
      expect(names).toEqual(["DeleteObjectCommand"])
    })

    it("minio: resolves even when send rejects", async () => {
      const service = buildService("minio")
      mockS3Send.mockRejectedValue(new Error("network"))
      await expect(service.deleteObject("surveys/s/a.jpg")).resolves.toBeUndefined()
    })

    it("local: removes the file under the root with force", async () => {
      const service = buildService("local")
      await service.deleteObject("surveys/s/a.jpg")
      expect(mockRm).toHaveBeenCalledWith(resolve(ROOT, "surveys/s/a.jpg"), { force: true })
    })

    it("local: resolves even when rm rejects", async () => {
      const service = buildService("local")
      mockRm.mockRejectedValue(new Error("EPERM"))
      await expect(service.deleteObject("surveys/s/a.jpg")).resolves.toBeUndefined()
    })

    it("resolves without touching storage for an escaping key", async () => {
      const service = buildService("local")
      await expect(service.deleteObject("../../etc/passwd")).resolves.toBeUndefined()
      expect(mockRm).not.toHaveBeenCalled()
    })
  })

  describe("StorageModule", () => {
    it("provides and exports StorageService", () => {
      const providers = Reflect.getMetadata("providers", StorageModule)
      const exported = Reflect.getMetadata("exports", StorageModule)
      expect(providers).toEqual([StorageService])
      expect(exported).toEqual([StorageService])
    })
  })
})
