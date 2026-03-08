import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SurveysService } from './surveys.service';
import { SurveyUpsertBody } from './surveys.types';

@Controller('surveys')
@UseGuards(AuthGuard)
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    const items = await this.surveysService.listForUser(user, status);
    return { items, next_cursor: null };
  }

  @Post()
  async upsert(@CurrentUser() user: AuthenticatedUser, @Body() body: SurveyUpsertBody) {
    return this.surveysService.upsertForUser(user, body);
  }
}
