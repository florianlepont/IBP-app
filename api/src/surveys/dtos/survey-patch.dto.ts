import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from "class-validator"
import { MAX_PARCEL_IDS, PARCEL_ID_PATTERN } from "./parcel-id.constants"

export class SurveyPatchDto {
  @IsOptional()
  @IsString()
  site_name?: string

  @IsOptional()
  @IsEnum(["private", "public"])
  visibility?: "private" | "public"

  @IsOptional()
  @IsString()
  @Matches(PARCEL_ID_PATTERN)
  parcel_id?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PARCEL_IDS)
  @IsString({ each: true })
  @Matches(PARCEL_ID_PATTERN, { each: true })
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
  @IsEnum(["ACA", "M"])
  region_version?: "ACA" | "M"

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
