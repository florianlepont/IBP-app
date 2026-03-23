import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator"

export class PatchMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  display_name?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  profile_picture_url?: string | null
}
