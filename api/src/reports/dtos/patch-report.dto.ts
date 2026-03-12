import { IsEnum, IsOptional } from 'class-validator'
import { ReportStatus } from '../reports.types'

export class PatchReportDto {
  @IsOptional()
  @IsEnum(['open', 'reviewed'])
  status?: ReportStatus
}
