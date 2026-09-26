import { BadRequestException, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises"
import { dirname, isAbsolute, resolve, sep } from "path"
import { extensionFromMime, isAllowedMimeType } from "../common/file.utils"
import { isSafeId } from "../common/safe-id"
import { appConfigOf } from "../config/app-config"

export const DOWNLOAD_URL_TTL_SECONDS = 300
export const UPLOAD_URL_TTL_SECONDS = 15 * 60

export type StorageMode = "local" | "minio"

function isObjectNotFound(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const candidate = err as { name?: unknown; $metadata?: { httpStatusCode?: unknown } }
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  )
}

function isFileNotFound(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as NodeJS.ErrnoException).code === "ENOENT"
}

// D-05: the single owner of stored files (survey attachments and profile pictures), in
// MinIO/S3 or local mode. Configuration comes from ConfigService (the existing variables).
@Injectable()
export class StorageService {
  readonly mode: StorageMode
  private readonly bucket: string
  private readonly uploadsRootDir: string
  private readonly s3Client?: S3Client
  private bucketReady = false

  constructor(config: ConfigService) {
    // D-01: values and defaults come from the validated config (app-config.ts). D-05: one
    // default bucket (ibp-media) for every stored file.
    const storage = appConfigOf(config).storage
    this.mode = storage.mode
    this.bucket = storage.bucket
    this.uploadsRootDir = storage.uploadsDir

    if (this.mode === "minio") {
      this.s3Client = new S3Client({
        endpoint: storage.endpoint,
        region: storage.region,
        forcePathStyle: true,
        credentials: {
          accessKeyId: storage.accessKey,
          secretAccessKey: storage.secretKey,
        },
      })
    }
  }

  // D-14: keys are built only here, from ids that match the safe-id pattern, so a
  // client-chosen survey id can never introduce "/", ".." or other path characters.
  buildAttachmentKey(surveyId: string, attachmentId: string, mimeType: string): string {
    this.assertSafeId(surveyId)
    this.assertSafeId(attachmentId)
    return `surveys/${surveyId}/${attachmentId}${this.extensionOrThrow(mimeType)}`
  }

  buildProfilePictureKey(userId: string, mimeType: string): string {
    this.assertSafeId(userId)
    return `profiles/${userId}/avatar${this.extensionOrThrow(mimeType)}`
  }

  // D-07/D-14: in local mode a key must resolve under the upload root.
  resolveLocalPath(key: string): string {
    const root = resolve(this.uploadsRootDir)
    const filePath = resolve(root, key)
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      throw new BadRequestException("Invalid storage key")
    }
    return filePath
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.assertValidKey(key)

    if (this.s3Client) {
      await this.ensureBucket(this.s3Client)
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      )
      return
    }

    const filePath = this.resolveLocalPath(key)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, body)
  }

  // D-08: ContentLength is set on the command, so the SDK signs `content-length` and the
  // object store rejects an upload whose body differs from the declared size.
  async presignPut(key: string, contentType: string, contentLength: number): Promise<string> {
    this.assertValidKey(key)
    const client = this.requireS3Client("presignPut")
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new BadRequestException("Invalid content length")
    }

    await this.ensureBucket(client)
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    })
    return getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS })
  }

  async presignGet(key: string): Promise<string> {
    this.assertValidKey(key)
    const client = this.requireS3Client("presignGet")

    await this.ensureBucket(client)
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(client, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS })
  }

  // D-15: a missing object is null; any other error propagates.
  async headObject(key: string): Promise<{ contentLength: number } | null> {
    this.assertValidKey(key)

    if (this.s3Client) {
      await this.ensureBucket(this.s3Client)
      try {
        const result = await this.s3Client.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
        )
        return { contentLength: result.ContentLength ?? 0 }
      } catch (err) {
        if (isObjectNotFound(err)) return null
        throw err
      }
    }

    try {
      const info = await stat(this.resolveLocalPath(key))
      return { contentLength: info.size }
    } catch (err) {
      if (isFileNotFound(err)) return null
      throw err
    }
  }

  // D-15: a missing object is null; any other error propagates.
  async getObject(key: string): Promise<Buffer | null> {
    this.assertValidKey(key)

    if (this.s3Client) {
      await this.ensureBucket(this.s3Client)
      try {
        const result = await this.s3Client.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        )
        if (!result.Body) return null
        return Buffer.from(await result.Body.transformToByteArray())
      } catch (err) {
        if (isObjectNotFound(err)) return null
        throw err
      }
    }

    try {
      return await readFile(this.resolveLocalPath(key))
    } catch (err) {
      if (isFileNotFound(err)) return null
      throw err
    }
  }

  // Best-effort: never throws. Callers run it after their transaction has committed.
  async deleteObject(key: string): Promise<void> {
    try {
      this.assertValidKey(key)

      if (this.s3Client) {
        await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
        return
      }

      await rm(this.resolveLocalPath(key), { force: true })
    } catch {
      // Cleanup failures must not fail the caller.
    }
  }

  private assertSafeId(value: string): void {
    if (!isSafeId(value)) {
      throw new BadRequestException("Invalid storage key")
    }
  }

  private extensionOrThrow(mimeType: string): string {
    // D-09: unsupported types answer 400, never the plain Error of extensionFromMime (500).
    if (typeof mimeType !== "string" || !isAllowedMimeType(mimeType)) {
      throw new BadRequestException("Unsupported file type")
    }
    return extensionFromMime(mimeType)
  }

  // D-07/D-14: every keyed call checks the key before touching storage.
  private assertValidKey(key: string): void {
    if (typeof key !== "string" || key.length === 0 || key.includes("\0") || isAbsolute(key)) {
      throw new BadRequestException("Invalid storage key")
    }
    if (this.mode === "local") {
      this.resolveLocalPath(key)
    }
  }

  private requireS3Client(operation: string): S3Client {
    if (!this.s3Client) {
      throw new Error(`${operation} is only available in minio mode`)
    }
    return this.s3Client
  }

  private async ensureBucket(client: S3Client): Promise<void> {
    if (this.bucketReady) return

    try {
      await client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      this.bucketReady = true
      return
    } catch {
      // Bucket might not exist yet.
    }

    try {
      await client.send(new CreateBucketCommand({ Bucket: this.bucket }))
      this.bucketReady = true
    } catch {
      // If created concurrently by another request/process, verify it exists now.
      await client.send(new HeadBucketCommand({ Bucket: this.bucket }))
      this.bucketReady = true
    }
  }
}
