import { Controller, Get, Query } from '@nestjs/common';
import { SurveysService } from './surveys.service';

@Controller('public')
export class PublicController {
  constructor(private readonly surveysService: SurveysService) {}

  @Get('map-items')
  async getMapItems(@Query('from') from?: string, @Query('to') to?: string, @Query('region') region?: string) {
    return this.surveysService.getPublicMapItems({ from, to, region });
  }
}
