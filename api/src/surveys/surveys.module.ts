import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';
import { IbpRulesService } from './ibp-rules.service';

@Module({
  imports: [AuthModule],
  controllers: [SurveysController],
  providers: [SurveysService, IbpRulesService]
})
export class SurveysModule {}
