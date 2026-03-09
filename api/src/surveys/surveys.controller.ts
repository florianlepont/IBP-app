import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SurveyPatchBody, SurveyUpsertBody } from './surveys.types';
import { SurveysService } from './surveys.service';

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

  @Get(':id')
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.surveysService.getSurveyById(user, id);
  }

  @Patch(':id')
  async patch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: SurveyPatchBody) {
    return this.surveysService.patchSurvey(user, id, body);
  }

  @Post(':id/submit')
  async submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.surveysService.submitSurvey(user, id);
  }

  @Get(':id/events')
  async events(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.surveysService.getEvents(user, id);
  }
}
