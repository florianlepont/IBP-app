import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { DebugService } from './debug.service';

@Controller('debug')
@UseGuards(AuthGuard)
export class DebugController {
  constructor(private readonly debugService: DebugService) {}

  @Post('reset-ibp-data')
  async resetIbpData() {
    return this.debugService.resetIbpData();
  }

  @Post('reset-user-data')
  async resetUserData() {
    return this.debugService.resetUserData();
  }
}
