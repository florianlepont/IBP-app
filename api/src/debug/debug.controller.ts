import { Body, Controller, ForbiddenException, Post, UseGuards } from "@nestjs/common"
import * as jwt from "jsonwebtoken"
import { AdminGuard } from "../auth/admin.guard"
import { AuthGuard } from "../auth/auth.guard"
import { DatabaseService } from "../database/database.service"
import { DebugService } from "./debug.service"

@Controller("debug")
export class DebugController {
  constructor(
    private readonly debugService: DebugService,
    private readonly db: DatabaseService,
  ) {}

  @Post("test-token")
  async getTestToken(@Body() body: { email: string }): Promise<{ access_token: string }> {
    if (process.env.NODE_ENV !== "test") throw new ForbiddenException()
    const secret = process.env.ACCESS_TOKEN_SECRET
    if (!secret) throw new ForbiddenException("ACCESS_TOKEN_SECRET not set")

    const email = body.email
    let user = await this.db
      .query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email])
      .then((r) => r.rows[0])

    if (!user) {
      const displayName = email.split("@")[0]
      user = await this.db
        .query<{ id: string }>(
          `INSERT INTO users (id, auth0_sub, email, display_name, first_name, last_name, role)
           VALUES (gen_random_uuid(), $1, $2, $3, '', '', 'contributor')
           RETURNING id`,
          [`test|${email}`, email, displayName],
        )
        .then((r) => r.rows[0])
    }

    const access_token = jwt.sign({ sub: user.id }, secret, {
      algorithm: "HS256",
      expiresIn: "1h",
    })
    return { access_token }
  }

  @Post("reset-ibp-data")
  @UseGuards(AuthGuard, AdminGuard)
  async resetIbpData() {
    return this.debugService.resetIbpData()
  }

  @Post("reset-user-data")
  @UseGuards(AuthGuard, AdminGuard)
  async resetUserData() {
    return this.debugService.resetUserData()
  }
}
