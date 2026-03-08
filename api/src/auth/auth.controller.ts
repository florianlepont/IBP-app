import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    return this.authService.login(body.email ?? '', body.password ?? '');
  }

  @Post('refresh')
  async refresh(@Body() body: { refresh_token?: string }) {
    return this.authService.refresh(body.refresh_token ?? '');
  }

  @Post('logout')
  @HttpCode(204)
  logout(): void {
    // Dev mode token strategy has no server-side revocation state.
  }
}
