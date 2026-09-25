import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { SurveysDataModule } from "../surveys/surveys-data.module"
import { ReportsController } from "./reports.controller"
import { ReportsService } from "./reports.service"

@Module({
  imports: [AuthModule, SurveysDataModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
