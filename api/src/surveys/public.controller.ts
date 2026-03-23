import { Controller, Get, Query } from "@nestjs/common"
import { SurveysService } from "./surveys.service"
import { PublicMapItemsQueryDto } from "./dtos/public-map-items-query.dto"
import { PublicParcelStatusesQueryDto } from "./dtos/public-parcel-statuses-query.dto"

@Controller("public")
export class PublicController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get("map-items")
  async getMapItems(@Query() query: PublicMapItemsQueryDto) {
    return this.surveysService.getPublicMapItems(query)
  }

  @Get("parcels/status")
  async getParcelStatuses(@Query() query: PublicParcelStatusesQueryDto) {
    return this.surveysService.getPublicParcelStatuses(query)
  }
}
