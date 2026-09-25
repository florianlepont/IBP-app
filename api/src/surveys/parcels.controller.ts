import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser } from "../auth/current-user.decorator"
import { AuthenticatedUser } from "../auth/auth.types"
import { ParcelsService } from "./parcels.service"

@Controller("parcels")
@UseGuards(AuthGuard)
export class ParcelsController {
  constructor(private readonly parcelsService: ParcelsService) {}

  @Get("resolve")
  async resolve(@Query("lat") lat?: string, @Query("lng") lng?: string) {
    return this.parcelsService.resolveParcelByCoordinates({ lat, lng })
  }

  @Get(":parcelId/surveys/history")
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("parcelId") parcelId: string,
    @Query("limit") limit?: string,
  ) {
    return this.parcelsService.getParcelSurveyHistory(user, parcelId, limit)
  }
}
