import "dotenv/config"
import { INestApplication } from "@nestjs/common"
import { Test, TestingModule } from "@nestjs/testing"
import request = require("supertest")
import { AppModule } from "../src/app.module"

describe("Auth + profile (e2e)", () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix("v1")
    await app.init()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it("returns profile fields via GET /me after test login", async () => {
    const email = `e2e-profile-${Date.now()}@ibp.local`
    const login = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)

    const accessToken = login.body.access_token as string
    const me = await request(app.getHttpServer())
      .get("/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)

    expect(me.body.email).toBe(email)
    expect(typeof me.body.display_name).toBe("string")
  })

  it("uploads, serves and deletes profile picture", async () => {
    const email = `e2e-avatar-${Date.now()}@ibp.local`
    const login = await request(app.getHttpServer())
      .post("/v1/debug/test-token")
      .send({ email })
      .expect(201)

    const accessToken = login.body.access_token as string
    const pngStub = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

    const upload = await request(app.getHttpServer())
      .put("/v1/me/profile-picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .attach("file", pngStub, { filename: "avatar.png", contentType: "image/png" })
      .expect(200)

    expect(typeof upload.body.profile_picture_url).toBe("string")

    const me = await request(app.getHttpServer())
      .get("/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
    expect(typeof me.body.profile_picture_url).toBe("string")

    const picture = await request(app.getHttpServer())
      .get("/v1/me/profile-picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
    expect(String(picture.headers["content-type"] ?? "")).toContain("image/")
    expect(picture.body.length).toBeGreaterThan(0)

    await request(app.getHttpServer())
      .delete("/v1/me/profile-picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204)

    await request(app.getHttpServer())
      .get("/v1/me/profile-picture")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404)
  })
})
