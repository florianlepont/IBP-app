import { IsOptional, IsString, MaxLength } from "class-validator"
import { REPORT_REASON_MAX_LENGTH } from "../reports.types"

export class CreateReportDto {
  @IsOptional()
  @IsString()
  survey_id?: string

  @IsOptional()
  @IsString()
  @MaxLength(REPORT_REASON_MAX_LENGTH)
  reason?: string
}
