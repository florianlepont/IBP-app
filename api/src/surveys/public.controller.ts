import { Controller, Get, Query } from "@nestjs/common"
import { PublicMapService } from "./public-map.service"
import { PublicMapItemsQueryDto } from "./dtos/public-map-items-query.dto"
import { PublicParcelStatusesQueryDto } from "./dtos/public-parcel-statuses-query.dto"

@Controller("public")
export class PublicController {
  constructor(private readonly publicMap: PublicMapService) {}

  @Get("map-items")
  async getMapItems(@Query() query: PublicMapItemsQueryDto) {
    return this.publicMap.getPublicMapItems(query)
  }

  @Get("parcels/status")
  async getParcelStatuses(@Query() query: PublicParcelStatusesQueryDto) {
    return this.publicMap.getPublicParcelStatuses(query)
  }
}
