import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { IbpRulesService } from './ibp-rules.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [AuthModule],
  controllers: [SurveysController, SyncController],
  providers: [SurveysService, IbpRulesService]
})
export class SurveysModule {}
