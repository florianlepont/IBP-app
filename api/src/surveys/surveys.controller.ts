import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateAttachmentBody, SurveyPatchBody, SurveyUpsertBody } from './surveys.types';
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

  @Post(':id/attachments')
  async createAttachment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: CreateAttachmentBody) {
    return this.surveysService.createAttachment(user, id, body);
  }

  @Get(':id/attachments')
  async listAttachments(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.surveysService.listAttachments(user, id);
  }

  @Put(':id/attachments/:attachmentId/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 }
    })
  )
  async uploadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Query('token') token?: string,
    @UploadedFile() file?: { buffer: Buffer; mimetype?: string; size?: number; originalname?: string }
  ) {
    return this.surveysService.uploadAttachment(user, id, attachmentId, token, file);
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(204)
  async deleteAttachment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('attachmentId') attachmentId: string) {
    await this.surveysService.deleteAttachment(user, id, attachmentId);
  }

  @Get(':id/events')
  async events(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.surveysService.getEvents(user, id);
  }
}
