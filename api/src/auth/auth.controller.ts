import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"

const isProd = process.env.NODE_ENV === "production"
const throttle = (prodLimit: number, ttl: number) => ({
  default: { ttl, limit: isProd ? prodLimit : 10_000 },
})
import { CurrentUser } from "./current-user.decorator"
import { AuthenticatedUser } from "./auth.types"
import { AuthGuard } from "./auth.guard"
import { AuthService } from "./auth.service"
import { LoginDto } from "./dtos/login.dto"
import { RegisterDto } from "./dtos/register.dto"
import { RefreshTokenDto } from "./dtos/refresh-token.dto"
import { VerifyEmailDto } from "./dtos/verify-email.dto"
import { ResendVerificationDto } from "./dtos/resend-verification.dto"

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle(throttle(5, 60_000))
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password, {
      createIfMissing: body.create_if_missing,
    })
  }

  @Post("register")
  @Throttle(throttle(5, 3_600_000))
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.display_name)
  }

  @Post("verify-email")
  @HttpCode(204)
  async verifyEmail(@Body() body: VerifyEmailDto): Promise<void> {
    await this.authService.verifyEmail(body.token)
  }

  @Post("resend-verification")
  @HttpCode(204)
  @Throttle(throttle(3, 60_000))
  async resendVerification(@Body() body: ResendVerificationDto): Promise<void> {
    await this.authService.resendVerification(body.email)
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
