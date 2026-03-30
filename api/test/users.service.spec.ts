import { BadRequestException, NotFoundException } from "@nestjs/common"
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
  const db = {
    query: jest.fn(),
  }
  const auth0Management = {
    updateEmail: jest.fn(),
  }

  return {
    service: new UsersService(db as never, auth0Management as never),
    db,
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
})
