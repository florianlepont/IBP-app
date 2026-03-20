import { IsOptional, IsString } from "class-validator"

export class PatchMeDto {
  @IsOptional()
  @IsString()
  first_name?: string

  @IsOptional()
  @IsString()
  last_name?: string

  @IsOptional()
  @IsString()
  display_name?: string

  @IsOptional()
  @IsString()
  email?: string

  @IsOptional()
  @IsString()
  profile_picture_url?: string | null
}
