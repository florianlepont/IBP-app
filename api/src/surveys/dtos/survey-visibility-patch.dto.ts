import { IsEnum, IsOptional } from 'class-validator'

export class SurveyVisibilityPatchDto {
  @IsOptional()
  @IsEnum(['private', 'public'])
  visibility?: 'private' | 'public'
}
