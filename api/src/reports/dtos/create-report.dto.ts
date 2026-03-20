import { IsOptional, IsString } from "class-validator"

export class CreateReportDto {
  @IsOptional()
  @IsString()
  survey_id?: string

  @IsOptional()
  @IsString()
  reason?: string
}
