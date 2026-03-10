import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParcelsController } from './parcels.controller';
import { PublicController } from './public.controller';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { IbpRulesService } from './ibp-rules.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [AuthModule],
  controllers: [SurveysController, SyncController, PublicController, ParcelsController],
  providers: [SurveysService, IbpRulesService]
})
export class SurveysModule {}
