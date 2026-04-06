import { BadRequestException, NotFoundException } from "@nestjs/common"
import { mkdir, readFile, rm, writeFile } from "fs/promises"
import { UsersService } from "../src/users/users.service"

jest.mock("fs/promises")

const AUTH_USER = {
  id: "user-1",
  auth0_sub: "auth0|user-1",
  email: "user@example.com",
  role: "contributor" as const,
  first_name: "User",
  last_name: "Example",
  display_name: "User Example",
  profile_picture_url: null,
}

function buildUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: AUTH_USER.id,
    email: AUTH_USER.email,
    role: AUTH_USER.role,
    first_name: AUTH_USER.first_name,
    last_name: AUTH_USER.last_name,
    display_name: AUTH_USER.display_name,
    profile_picture_url: null,
    updated_at: "2026-03-30T00:00:00.000Z",
    profile_picture_storage_key: null,
    profile_picture_mime_type: null,
    ...overrides,
  }
}

function buildService() {
  const client = {
    query: jest.fn(),
    release: jest.fn(),
  }
  const db = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(client),
  }
  const auth0Management = {
    updateEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    deleteUser: jest.fn(),
  }

  return {
    service: new UsersService(db as never, auth0Management as never),
    db,
    client,
    auth0Management,
  }
}

describe("UsersService", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns the current profile", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({ rows: [buildUserRow()] })

    const result = await service.getMe(AUTH_USER.id)

    expect(result).toEqual(
      expect.objectContaining({
        id: AUTH_USER.id,
        email: AUTH_USER.email,
        display_name: AUTH_USER.display_name,
      }),
    )
  })

  it("throws when getMe cannot find the user", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({ rows: [] })

    await expect(service.getMe(AUTH_USER.id)).rejects.toBeInstanceOf(NotFoundException)
  })

  it("patches profile fields", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({
      rows: [buildUserRow({ display_name: "Algernon" })],
    })

    const result = await service.patchMe(AUTH_USER, { display_name: "Algernon" })

    expect(result).toEqual(expect.objectContaining({ display_name: "Algernon" }))
  })

  it("throws when patchMe cannot find the user", async () => {
    const { service, db } = buildService()
    db.query.mockResolvedValueOnce({ rows: [] })

    await expect(service.patchMe(AUTH_USER, { display_name: "Ghost" })).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it("changeEmail updates Auth0 and the DB", async () => {
    const { service, db, auth0Management } = buildService()
    auth0Management.updateEmail.mockResolvedValueOnce(undefined)
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })

    await service.changeEmail(AUTH_USER, "new@example.com")

    expect(auth0Management.updateEmail).toHaveBeenCalledWith(AUTH_USER.auth0_sub, "new@example.com")
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE users"), [
      "new@example.com",
      AUTH_USER.id,
    ])
  })

  it("changeEmail throws when new email is the same as current", async () => {
    const { service } = buildService()

    await expect(service.changeEmail(AUTH_USER, AUTH_USER.email)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it("changeEmail rolls back Auth0 and throws BadRequestException on unique violation", async () => {
    const { service, db, auth0Management } = buildService()
    auth0Management.updateEmail.mockResolvedValueOnce(undefined)
    const uniqueViolation = Object.assign(new Error("unique violation"), { code: "23505" })
    db.query.mockRejectedValueOnce(uniqueViolation)
    auth0Management.updateEmail.mockResolvedValueOnce(undefined)

    await expect(service.changeEmail(AUTH_USER, "taken@example.com")).rejects.toMatchObject({
      message: "Email already taken",
    })

    // Auth0 rollback should restore the original email
    expect(auth0Management.updateEmail).toHaveBeenLastCalledWith(
      AUTH_USER.auth0_sub,
      AUTH_USER.email,
    )
  })

  it("changeEmail rethrows unexpected DB errors", async () => {
    const { service, db, auth0Management } = buildService()
    auth0Management.updateEmail.mockResolvedValueOnce(undefined)
    db.query.mockRejectedValueOnce(new Error("connection timeout"))

    await expect(service.changeEmail(AUTH_USER, "other@example.com")).rejects.toThrow(
      "connection timeout",
    )
  })

  it("sendPasswordReset calls Auth0 with the user email", async () => {
    const { service, auth0Management } = buildService()
    auth0Management.sendPasswordResetEmail.mockResolvedValueOnce(undefined)

    await service.sendPasswordReset(AUTH_USER)

    expect(auth0Management.sendPasswordResetEmail).toHaveBeenCalledWith(AUTH_USER.email)
  })

  describe("uploadProfilePicture", () => {
    it("throws BadRequestException when no file is provided", async () => {
      const { service } = buildService()
      await expect(service.uploadProfilePicture(AUTH_USER, undefined)).rejects.toBeInstanceOf(
        BadRequestException,
      )
    })

    it("throws BadRequestException when file buffer is empty", async () => {
      const { service } = buildService()
      await expect(
        service.uploadProfilePicture(AUTH_USER, {
          buffer: Buffer.alloc(0),
          mimetype: "image/jpeg",
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it("throws BadRequestException when file exceeds max size", async () => {
      const { service } = buildService()
      const bigBuffer = Buffer.alloc(11 * 1024 * 1024)
      await expect(
        service.uploadProfilePicture(AUTH_USER, { buffer: bigBuffer, mimetype: "image/jpeg" }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it("throws BadRequestException when file is not an image", async () => {
      const { service } = buildService()
      await expect(
        service.uploadProfilePicture(AUTH_USER, {
          buffer: Buffer.from("data"),
          mimetype: "application/pdf",
        }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it("uploads and updates profile picture successfully", async () => {
      const { service, db } = buildService()
      ;(mkdir as jest.Mock).mockResolvedValue(undefined)
      ;(writeFile as jest.Mock).mockResolvedValue(undefined)
      // findUserMeRow (no previous picture)
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: null })],
      })
      // UPDATE users
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_url: "/me/profile-picture?v=1" })],
      })

      const result = await service.uploadProfilePicture(AUTH_USER, {
        buffer: Buffer.from("img"),
        mimetype: "image/jpeg",
      })

      expect(result.profile_picture_url).toMatch(/\/me\/profile-picture/)
      expect(writeFile).toHaveBeenCalled()
    })

    it("deletes old picture when a different storage key exists", async () => {
      const { service, db } = buildService()
      ;(mkdir as jest.Mock).mockResolvedValue(undefined)
      ;(writeFile as jest.Mock).mockResolvedValue(undefined)
      ;(rm as jest.Mock).mockResolvedValue(undefined)
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/old-avatar.png" })],
      })
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_url: "/me/profile-picture?v=2" })],
      })

      await service.uploadProfilePicture(AUTH_USER, {
        buffer: Buffer.from("img"),
        mimetype: "image/jpeg",
      })

      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining("old-avatar.png"),
        expect.objectContaining({ force: true }),
      )
    })

    it("throws NotFoundException when user not found after writing file", async () => {
      const { service, db } = buildService()
      ;(mkdir as jest.Mock).mockResolvedValue(undefined)
      ;(writeFile as jest.Mock).mockResolvedValue(undefined)
      db.query.mockResolvedValueOnce({ rows: [] }) // findUserMeRow returns nothing

      await expect(
        service.uploadProfilePicture(AUTH_USER, {
          buffer: Buffer.from("img"),
          mimetype: "image/png",
        }),
      ).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe("getProfilePicture", () => {
    it("throws NotFoundException when no storage key in DB", async () => {
      const { service, db } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [{ profile_picture_storage_key: null, profile_picture_mime_type: null }],
      })

      await expect(service.getProfilePicture(AUTH_USER)).rejects.toBeInstanceOf(NotFoundException)
    })

    it("throws NotFoundException when file is missing on disk", async () => {
      const { service, db } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [
          {
            profile_picture_storage_key: "profiles/user-1/avatar.jpg",
            profile_picture_mime_type: "image/jpeg",
          },
        ],
      })
      ;(readFile as jest.Mock).mockRejectedValueOnce(new Error("ENOENT"))

      await expect(service.getProfilePicture(AUTH_USER)).rejects.toBeInstanceOf(NotFoundException)
    })

    it("returns buffer and mimeType when file exists", async () => {
      const { service, db } = buildService()
      const imageBuffer = Buffer.from("fake-image")
      db.query.mockResolvedValueOnce({
        rows: [
          {
            profile_picture_storage_key: "profiles/user-1/avatar.jpg",
            profile_picture_mime_type: "image/jpeg",
          },
        ],
      })
      ;(readFile as jest.Mock).mockResolvedValueOnce(imageBuffer)

      const result = await service.getProfilePicture(AUTH_USER)

      expect(result.buffer).toBe(imageBuffer)
      expect(result.mimeType).toBe("image/jpeg")
    })
  })

  describe("removeProfilePicture", () => {
    it("throws NotFoundException when user is not found", async () => {
      const { service, db } = buildService()
      db.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.removeProfilePicture(AUTH_USER)).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })

    it("removes file and clears picture url when storage key exists", async () => {
      const { service, db } = buildService()
      ;(rm as jest.Mock).mockResolvedValue(undefined)
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/avatar.jpg" })],
      })
      db.query.mockResolvedValueOnce({ rows: [buildUserRow({ profile_picture_url: null })] })

      const result = await service.removeProfilePicture(AUTH_USER)

      expect(rm).toHaveBeenCalledWith(
        expect.stringContaining("avatar.jpg"),
        expect.objectContaining({ force: true }),
      )
      expect(result.profile_picture_url).toBeNull()
    })

    it("skips file deletion when no storage key exists", async () => {
      const { service, db } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: null })],
      })
      db.query.mockResolvedValueOnce({ rows: [buildUserRow()] })

      await service.removeProfilePicture(AUTH_USER)

      expect(rm).not.toHaveBeenCalled()
    })
  })

  it("deletes the Auth0 account, anonymizes submitted surveys, and removes the user row", async () => {
    const { service, db, client, auth0Management } = buildService()
    db.query.mockResolvedValueOnce({
      rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/avatar.png" })],
    })
    auth0Management.deleteUser.mockResolvedValueOnce(undefined)
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ storage_key: "attachments/survey-draft/photo.jpg" }] }) // collect draft attachment keys
      .mockResolvedValueOnce({}) // UPDATE survey_events SET actor_id = NULL
      .mockResolvedValueOnce({}) // UPDATE surveys SET user_id = NULL
      .mockResolvedValueOnce({}) // DELETE FROM attachments
      .mockResolvedValueOnce({}) // DELETE FROM survey_events
      .mockResolvedValueOnce({}) // DELETE FROM surveys
      .mockResolvedValueOnce({}) // DELETE FROM users
      .mockResolvedValue({}) // COMMIT

    await service.deleteAccount(AUTH_USER)

    expect(auth0Management.deleteUser).toHaveBeenCalledWith(AUTH_USER.auth0_sub)
    expect(db.connect).toHaveBeenCalledTimes(1)
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN")
    // Storage keys collected first, before any UPDATE/DELETE
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("FROM attachments a"),
      [AUTH_USER.id],
    )
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("SET actor_id = NULL"),
      [AUTH_USER.id],
    )
    expect(client.query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("SET user_id = NULL"),
      [AUTH_USER.id],
    )
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM attachments"),
      [AUTH_USER.id],
    )
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM survey_events"),
      [AUTH_USER.id],
    )
    expect(client.query).toHaveBeenCalledWith(
      `DELETE FROM surveys WHERE user_id = $1`,
      [AUTH_USER.id],
    )
    expect(client.query).toHaveBeenCalledWith(`DELETE FROM users WHERE id = $1`, [AUTH_USER.id])
    expect(client.query).toHaveBeenLastCalledWith("COMMIT")
    expect(client.release).toHaveBeenCalledTimes(1)
  })
})
