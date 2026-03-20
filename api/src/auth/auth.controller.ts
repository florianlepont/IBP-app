import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { CurrentUser } from "./current-user.decorator"
import { AuthenticatedUser } from "./auth.types"
import { AuthGuard } from "./auth.guard"
import { AuthService } from "./auth.service"
import { LoginDto } from "./dtos/login.dto"
import { RegisterDto } from "./dtos/register.dto"
import { RefreshTokenDto } from "./dtos/refresh-token.dto"

@Controller("auth")
@Throttle({ auth: { ttl: 60_000, limit: 10 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password, {
      createIfMissing: body.create_if_missing,
    })
  }

  @Post("register")
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.display_name)
  }

  @Post("refresh")
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refresh_token ?? "")
  }

  @Post("logout")
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logout(user.id)
  }
}
