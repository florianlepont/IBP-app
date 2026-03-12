import { IsArray, IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator'

export class SurveyPatchDto {
  @IsOptional()
  @IsString()
  site_name?: string

  @IsOptional()
  @IsEnum(['private', 'public'])
  visibility?: 'private' | 'public'

  @IsOptional()
  @IsString()
  parcel_id?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  parcel_ids?: string[]

  @IsOptional()
  @IsNumber()
  observation_year?: number

  @IsOptional()
  @IsNumber()
  version_number?: number

  @IsOptional()
  @IsString()
  previous_survey_id?: string

  @IsOptional()
  @IsEnum(['ACA', 'M'])
  region_version?: 'ACA' | 'M'

  @IsOptional()
  @IsString()
  vegetation_stage?: string

  @IsOptional()
  @IsObject()
  factors?: Record<string, unknown>

  @IsOptional()
  @IsObject()
  scores?: Record<string, unknown>
}
