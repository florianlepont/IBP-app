import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser } from "../auth/current-user.decorator"
import { AuthenticatedUser } from "../auth/auth.types"
import { SurveysService } from "./surveys.service"

@Controller("parcels")
@UseGuards(AuthGuard)
export class ParcelsController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get("resolve")
  async resolve(@Query("lat") lat?: string, @Query("lng") lng?: string) {
    return this.surveysService.resolveParcelByCoordinates({ lat, lng })
  }

  @Get(":parcelId/surveys/history")
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("parcelId") parcelId: string,
    @Query("limit") limit?: string,
  ) {
    return this.surveysService.getParcelSurveyHistory(user, parcelId, limit)
  }
}
