import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser } from "../auth/current-user.decorator"
import { AuthenticatedUser } from "../auth/auth.types"
import { SYNC_THROTTLE } from "../common/rate-limit.config"
import { SurveysSyncService } from "./surveys-sync.service"
import { SyncBatchBody } from "./surveys.types"

@Controller("sync")
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly syncService: SurveysSyncService) {}

  @Post()
  @HttpCode(200)
  @Throttle(SYNC_THROTTLE)
  async syncBatch(@CurrentUser() user: AuthenticatedUser, @Body() body: SyncBatchBody) {
    return this.syncService.syncBatch(user, body)
  }

  @Get("changes")
  async getChanges(
    @CurrentUser() user: AuthenticatedUser,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit =
      typeof limit === "string" && limit.trim().length > 0 ? Number(limit) : undefined
    return this.syncService.getSyncChanges(
      user,
      cursor,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    )
  }
}
