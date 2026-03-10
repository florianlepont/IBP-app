import { Body, Controller, Get, Patch, Post, Query, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateReportBody, PatchReportBody } from './reports.types';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateReportBody) {
    return this.reportsService.createReport(user, body);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: string) {
    return this.reportsService.listReports(user, status);
  }

  @Patch(':id')
  patch(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: PatchReportBody) {
    return this.reportsService.reviewReport(user, id, body);
  }
}
