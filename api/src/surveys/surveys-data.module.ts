import { Module } from "@nestjs/common"
import { SurveyEventsService } from "./survey-events.service"
import { SurveysRepository } from "./surveys.repository"

// D-07: survey data access shared by SurveysModule and ReportsModule. Not global: consumers
// import SurveysDataModule explicitly. It imports neither module, so there is no cycle.
@Module({
  providers: [SurveysRepository, SurveyEventsService],
  exports: [SurveysRepository, SurveyEventsService],
})
export class SurveysDataModule {}
