import { Body, Controller, ForbiddenException, Post, UseGuards } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import * as jwt from "jsonwebtoken"
import { AdminGuard } from "../auth/admin.guard"
import { AuthGuard } from "../auth/auth.guard"
import { appConfigOf } from "../config/app-config"
import { NodeEnv } from "../config/config.types"
import { DatabaseService } from "../database/database.service"
import { DebugService } from "./debug.service"
import { getTestTokenSecret } from "./test-token-secret"

@Controller("debug")
export class DebugController {
  private readonly nodeEnv: NodeEnv

  constructor(
    private readonly debugService: DebugService,
    private readonly db: DatabaseService,
    config: ConfigService,
  ) {
    this.nodeEnv = appConfigOf(config).nodeEnv
  }

  @Post("test-token")
  async getTestToken(@Body() body: { email: string }): Promise<{ access_token: string }> {
    if (this.nodeEnv !== "test") throw new ForbiddenException()
    // D-04: the same per-process secret the AuthGuard test branch verifies with.
    const secret = getTestTokenSecret(this.nodeEnv)
    if (!secret) throw new ForbiddenException()

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
