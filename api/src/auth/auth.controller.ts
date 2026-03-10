import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from './auth.types';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email?: string; password?: string; create_if_missing?: boolean }) {
    return this.authService.login(body.email ?? '', body.password ?? '', {
      createIfMissing: body.create_if_missing
    });
  }

  @Post('register')
  async register(@Body() body: { email?: string; password?: string; display_name?: string }) {
    return this.authService.register(body.email ?? '', body.password ?? '', body.display_name ?? '');
  }

  @Post('refresh')
  async refresh(@Body() body: { refresh_token?: string }) {
    return this.authService.refresh(body.refresh_token ?? '');
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logout(user.id);
  }
}
