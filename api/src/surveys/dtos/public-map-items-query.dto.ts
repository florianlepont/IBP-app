import { IsOptional, IsString, MaxLength } from "class-validator"

export class PublicMapItemsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  from?: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  to?: string

  @IsOptional()
  @IsString()
  @MaxLength(8)
  region?: string
}
