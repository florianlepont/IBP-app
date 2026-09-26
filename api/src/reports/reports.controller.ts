import { Body, Controller, Get, Patch, Post, Query, Param, UseGuards } from "@nestjs/common"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser } from "../auth/current-user.decorator"
import { AuthenticatedUser } from "../auth/auth.types"
import { decodeListCursor, parseListLimit } from "../surveys/list-cursor"
import { REPORT_CURSOR_ID_PATTERN, ReportsService } from "./reports.service"
import { CreateReportDto } from "./dtos/create-report.dto"
import { PatchReportDto } from "./dtos/patch-report.dto"

@Controller("reports")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateReportDto) {
    return this.reportsService.createReport(user, body)
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: string,
    // D-11 / D-18 (C-4): individual query strings, not a class DTO.
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ) {
    const page = {
      limit: parseListLimit(limit),
      after: decodeListCursor(cursor, { idPattern: REPORT_CURSOR_ID_PATTERN }),
    }
    return this.reportsService.listReports(user, status, page)
  }

  @Patch(":id")
  patch(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: PatchReportDto,
  ) {
    return this.reportsService.reviewReport(user, id, body)
  }
}
