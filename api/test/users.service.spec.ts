import { BadRequestException, Logger, NotFoundException } from "@nestjs/common"
import { UsersService } from "../src/users/users.service"

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
    transaction: jest.fn(async (fn: (handle: typeof client) => Promise<unknown>) => {
      await client.query("BEGIN")
      try {
        const result = await fn(client)
        await client.query("COMMIT")
        return result
      } catch (error) {
        await Promise.resolve(client.query("ROLLBACK")).catch(() => undefined)
        throw error
      }
    }),
  }
  const auth0Management = {
    updateEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    deleteUser: jest.fn(),
  }
  const storage = {
    mode: "local" as const,
    buildProfilePictureKey: jest.fn(
      (userId: string, mimeType: string) =>
        `profiles/${userId}/avatar${mimeType === "image/png" ? ".png" : ".jpg"}`,
    ),
    putObject: jest.fn().mockResolvedValue(undefined),
    headObject: jest.fn(),
    getObject: jest.fn(),
    deleteObject: jest.fn().mockResolvedValue(undefined),
  }

  return {
    service: new UsersService(db as never, auth0Management as never, storage as never),
    db,
    client,
    auth0Management,
    storage,
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

  describe("getMe profile picture presence", () => {
    let loggerWarnSpy: jest.SpyInstance

    beforeEach(() => {
      loggerWarnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined)
    })

    afterEach(() => {
      loggerWarnSpy.mockRestore()
    })

    const withPicture = () =>
      buildUserRow({
        profile_picture_url: "/me/profile-picture?v=1",
        profile_picture_storage_key: "profiles/user-1/avatar.png",
        profile_picture_mime_type: "image/png",
      })

    it("returns a null url when the stored object is missing", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({ rows: [withPicture()] })
      storage.headObject.mockResolvedValueOnce(null)

      const result = await service.getMe(AUTH_USER.id)

      expect(storage.headObject).toHaveBeenCalledWith("profiles/user-1/avatar.png")
      expect(result.profile_picture_url).toBeNull()
      // getMe never clears the columns itself.
      expect(db.query).toHaveBeenCalledTimes(1)
    })

    it("keeps the url when the stored object exists", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({ rows: [withPicture()] })
      storage.headObject.mockResolvedValueOnce({ contentLength: 9 })

      const result = await service.getMe(AUTH_USER.id)

      expect(result.profile_picture_url).toBe("/me/profile-picture?v=1")
    })

    it("does not check storage when no key is stored", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_url: "https://example.com/external.png" })],
      })

      const result = await service.getMe(AUTH_USER.id)

      expect(storage.headObject).not.toHaveBeenCalled()
      expect(result.profile_picture_url).toBe("https://example.com/external.png")
    })

    it("keeps the url and logs a warning when the object store is unreachable", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({ rows: [withPicture()] })
      storage.headObject.mockRejectedValueOnce(new Error("connect ECONNREFUSED"))

      const result = await service.getMe(AUTH_USER.id)

      expect(result.profile_picture_url).toBe("/me/profile-picture?v=1")
      expect(loggerWarnSpy).toHaveBeenCalledTimes(1)
    })
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

    it.each(["application/pdf", "image/gif", "constructor", "__proto__", ""])(
      "throws BadRequestException for unsupported type %p and never writes",
      async (mimetype) => {
        const { service, db, storage } = buildService()
        await expect(
          service.uploadProfilePicture(AUTH_USER, { buffer: Buffer.from("data"), mimetype }),
        ).rejects.toBeInstanceOf(BadRequestException)
        expect(storage.putObject).not.toHaveBeenCalled()
        expect(db.query).not.toHaveBeenCalled()
      },
    )

    it("rejects a missing mimetype with BadRequestException", async () => {
      const { service, storage } = buildService()
      await expect(
        service.uploadProfilePicture(AUTH_USER, { buffer: Buffer.from("data") }),
      ).rejects.toBeInstanceOf(BadRequestException)
      expect(storage.putObject).not.toHaveBeenCalled()
    })

    it("writes through StorageService and updates the profile picture", async () => {
      const { service, db, storage } = buildService()
      const buffer = Buffer.from("img")
      // findUserMeRow (no previous picture)
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: null })],
      })
      // UPDATE users
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_url: "/me/profile-picture?v=1" })],
      })

      const result = await service.uploadProfilePicture(AUTH_USER, {
        buffer,
        mimetype: "Image/PNG ",
      })

      expect(result.profile_picture_url).toMatch(/\/me\/profile-picture/)
      expect(storage.buildProfilePictureKey).toHaveBeenCalledWith(AUTH_USER.id, "image/png")
      expect(storage.putObject).toHaveBeenCalledWith(
        "profiles/user-1/avatar.png",
        buffer,
        "image/png",
      )
      expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining("UPDATE users"), [
        AUTH_USER.id,
        expect.stringMatching(/^\/me\/profile-picture\?v=\d+$/),
        "profiles/user-1/avatar.png",
        "image/png",
      ])
      expect(storage.deleteObject).not.toHaveBeenCalled()
    })

    it("keeps the object when the previous key is the same", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/avatar.png" })],
      })
      db.query.mockResolvedValueOnce({ rows: [buildUserRow()] })

      await service.uploadProfilePicture(AUTH_USER, {
        buffer: Buffer.from("img"),
        mimetype: "image/png",
      })

      expect(storage.deleteObject).not.toHaveBeenCalled()
    })

    it("deletes the previous object after the DB update when the key differs", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/avatar.png" })],
      })
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_url: "/me/profile-picture?v=2" })],
      })

      await service.uploadProfilePicture(AUTH_USER, {
        buffer: Buffer.from("img"),
        mimetype: "image/jpeg",
      })

      expect(storage.deleteObject).toHaveBeenCalledWith("profiles/user-1/avatar.png")
      const updateOrder = db.query.mock.invocationCallOrder[1] as number
      expect(storage.deleteObject.mock.invocationCallOrder[0]).toBeGreaterThan(updateOrder)
    })

    it("does not delete the previous object when the DB update fails", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/avatar.png" })],
      })
      db.query.mockRejectedValueOnce(new Error("db down"))

      await expect(
        service.uploadProfilePicture(AUTH_USER, {
          buffer: Buffer.from("img"),
          mimetype: "image/jpeg",
        }),
      ).rejects.toThrow("db down")
      expect(storage.deleteObject).not.toHaveBeenCalled()
    })

    it("throws NotFoundException and writes nothing when the user is not found", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({ rows: [] }) // findUserMeRow returns nothing

      await expect(
        service.uploadProfilePicture(AUTH_USER, {
          buffer: Buffer.from("img"),
          mimetype: "image/png",
        }),
      ).rejects.toBeInstanceOf(NotFoundException)
      expect(storage.putObject).not.toHaveBeenCalled()
    })

    it("throws NotFoundException when the user disappears before the update", async () => {
      const { service, db } = buildService()
      db.query.mockResolvedValueOnce({ rows: [buildUserRow()] })
      db.query.mockResolvedValueOnce({ rows: [] })

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
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [{ profile_picture_storage_key: null, profile_picture_mime_type: null }],
      })

      await expect(service.getProfilePicture(AUTH_USER)).rejects.toBeInstanceOf(NotFoundException)
      expect(storage.getObject).not.toHaveBeenCalled()
    })

    it("throws NotFoundException and clears the stale columns when the object is missing", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [
          {
            profile_picture_storage_key: "profiles/user-1/avatar.jpg",
            profile_picture_mime_type: "image/jpeg",
          },
        ],
      })
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 1 })
      storage.getObject.mockResolvedValueOnce(null)

      await expect(service.getProfilePicture(AUTH_USER)).rejects.toBeInstanceOf(NotFoundException)

      expect(storage.getObject).toHaveBeenCalledWith("profiles/user-1/avatar.jpg")
      expect(db.query).toHaveBeenCalledTimes(2)
      const [sql, params] = db.query.mock.calls[1] as [string, unknown[]]
      expect(sql).toContain("UPDATE users")
      expect(sql).toContain("profile_picture_url = NULL")
      expect(sql).toContain("profile_picture_storage_key = NULL")
      expect(sql).toContain("profile_picture_mime_type = NULL")
      expect(sql).toMatch(/WHERE id = \$1\s+AND profile_picture_storage_key = \$2/)
      expect(params).toEqual([AUTH_USER.id, "profiles/user-1/avatar.jpg"])
    })

    it("propagates storage errors other than a missing object", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [
          {
            profile_picture_storage_key: "profiles/user-1/avatar.jpg",
            profile_picture_mime_type: "image/jpeg",
          },
        ],
      })
      storage.getObject.mockRejectedValueOnce(new Error("connect ECONNREFUSED"))

      await expect(service.getProfilePicture(AUTH_USER)).rejects.toThrow("ECONNREFUSED")
      expect(db.query).toHaveBeenCalledTimes(1)
    })

    it("returns buffer and mimeType when the object exists", async () => {
      const { service, db, storage } = buildService()
      const imageBuffer = Buffer.from("fake-image")
      db.query.mockResolvedValueOnce({
        rows: [
          {
            profile_picture_storage_key: "profiles/user-1/avatar.jpg",
            profile_picture_mime_type: "image/jpeg",
          },
        ],
      })
      storage.getObject.mockResolvedValueOnce(imageBuffer)

      const result = await service.getProfilePicture(AUTH_USER)

      expect(result).toEqual({ buffer: imageBuffer, mimeType: "image/jpeg" })
      expect(result.buffer).toBe(imageBuffer)
    })

    it("falls back to application/octet-stream when no mime type is stored", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [
          {
            profile_picture_storage_key: "profiles/user-1/avatar.jpg",
            profile_picture_mime_type: null,
          },
        ],
      })
      storage.getObject.mockResolvedValueOnce(Buffer.from("x"))

      const result = await service.getProfilePicture(AUTH_USER)

      expect(result.mimeType).toBe("application/octet-stream")
    })
  })

  describe("removeProfilePicture", () => {
    it("throws NotFoundException when user is not found", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.removeProfilePicture(AUTH_USER)).rejects.toBeInstanceOf(
        NotFoundException,
      )
      expect(storage.deleteObject).not.toHaveBeenCalled()
    })

    it("clears the picture url, then deletes the object", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/avatar.jpg" })],
      })
      db.query.mockResolvedValueOnce({ rows: [buildUserRow({ profile_picture_url: null })] })

      const result = await service.removeProfilePicture(AUTH_USER)

      expect(storage.deleteObject).toHaveBeenCalledWith("profiles/user-1/avatar.jpg")
      const updateOrder = db.query.mock.invocationCallOrder[1] as number
      expect(storage.deleteObject.mock.invocationCallOrder[0]).toBeGreaterThan(updateOrder)
      expect(result.profile_picture_url).toBeNull()
    })

    it("keeps the object when the DB update fails", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/avatar.jpg" })],
      })
      db.query.mockRejectedValueOnce(new Error("db down"))

      await expect(service.removeProfilePicture(AUTH_USER)).rejects.toThrow("db down")
      expect(storage.deleteObject).not.toHaveBeenCalled()
    })

    it("throws NotFoundException when the user disappears before the update", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/avatar.jpg" })],
      })
      db.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.removeProfilePicture(AUTH_USER)).rejects.toBeInstanceOf(
        NotFoundException,
      )
      expect(storage.deleteObject).not.toHaveBeenCalled()
    })

    it("skips object deletion when no storage key exists", async () => {
      const { service, db, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: null })],
      })
      db.query.mockResolvedValueOnce({ rows: [buildUserRow()] })

      await service.removeProfilePicture(AUTH_USER)

      expect(storage.deleteObject).not.toHaveBeenCalled()
    })
  })

  describe("deleteAccount", () => {
    let loggerErrorSpy: jest.SpyInstance

    beforeEach(() => {
      loggerErrorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined)
    })

    afterEach(() => {
      loggerErrorSpy.mockRestore()
    })

    it("commits the DB transaction, anonymizes submitted surveys and removes the user row, then deletes the Auth0 user", async () => {
      const { service, db, client, auth0Management, storage } = buildService()
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

      expect(db.transaction).toHaveBeenCalledTimes(1)
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
      expect(client.query).toHaveBeenCalledWith(`DELETE FROM surveys WHERE user_id = $1`, [
        AUTH_USER.id,
      ])
      expect(client.query).toHaveBeenCalledWith(`DELETE FROM users WHERE id = $1`, [AUTH_USER.id])
      expect(client.query).toHaveBeenLastCalledWith("COMMIT")

      expect(auth0Management.deleteUser).toHaveBeenCalledWith(AUTH_USER.auth0_sub)
      // A-M9: the DB transaction (BEGIN..COMMIT) must fully complete before Auth0 is touched.
      const lastDbCallOrder =
        client.query.mock.invocationCallOrder[client.query.mock.invocationCallOrder.length - 1]
      expect(auth0Management.deleteUser.mock.invocationCallOrder[0]).toBeGreaterThan(
        lastDbCallOrder,
      )

      // Storage cleanup (picture and draft attachment objects) runs only after the commit.
      expect(storage.deleteObject).toHaveBeenCalledTimes(2)
      expect(storage.deleteObject).toHaveBeenCalledWith("profiles/user-1/avatar.png")
      expect(storage.deleteObject).toHaveBeenCalledWith("attachments/survey-draft/photo.jpg")
      for (const order of storage.deleteObject.mock.invocationCallOrder) {
        expect(order).toBeGreaterThan(lastDbCallOrder)
      }
    })

    it("rolls back and never calls Auth0 or storage when the DB transaction fails", async () => {
      const { service, db, client, auth0Management, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/avatar.png" })],
      })
      const dbError = new Error("db failed")
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // collect draft attachment keys
        .mockRejectedValueOnce(dbError) // UPDATE survey_events SET actor_id = NULL

      await expect(service.deleteAccount(AUTH_USER)).rejects.toThrow("db failed")

      expect(client.query).toHaveBeenCalledWith("ROLLBACK")
      expect(auth0Management.deleteUser).not.toHaveBeenCalled()
      expect(storage.deleteObject).not.toHaveBeenCalled()
      expect(db.transaction).toHaveBeenCalledTimes(1)
    })

    it("resolves and logs a structured error when Auth0 deletion fails after commit", async () => {
      const { service, db, client, auth0Management, storage } = buildService()
      db.query.mockResolvedValueOnce({
        rows: [buildUserRow({ profile_picture_storage_key: "profiles/user-1/avatar.png" })],
      })
      client.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // collect draft attachment keys
        .mockResolvedValueOnce({}) // UPDATE survey_events SET actor_id = NULL
        .mockResolvedValueOnce({}) // UPDATE surveys SET user_id = NULL
        .mockResolvedValueOnce({}) // DELETE FROM attachments
        .mockResolvedValueOnce({}) // DELETE FROM survey_events
        .mockResolvedValueOnce({}) // DELETE FROM surveys
        .mockResolvedValueOnce({}) // DELETE FROM users
        .mockResolvedValue({}) // COMMIT
      const auth0Error = new Error("auth0 down")
      auth0Management.deleteUser.mockRejectedValueOnce(auth0Error)

      await expect(service.deleteAccount(AUTH_USER)).resolves.toBeUndefined()

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1)
      const [message] = loggerErrorSpy.mock.calls[0]
      expect(message).toContain(AUTH_USER.id)
      expect(message).toContain(AUTH_USER.auth0_sub)
      // storage cleanup still attempted despite the Auth0 failure
      expect(storage.deleteObject).toHaveBeenCalledWith("profiles/user-1/avatar.png")
    })

    it("throws NotFoundException and never calls Auth0 when the user row is missing", async () => {
      const { service, db, auth0Management } = buildService()
      db.query.mockResolvedValueOnce({ rows: [] })

      await expect(service.deleteAccount(AUTH_USER)).rejects.toBeInstanceOf(NotFoundException)
      expect(auth0Management.deleteUser).not.toHaveBeenCalled()
      expect(db.transaction).not.toHaveBeenCalled()
    })
  })
})
