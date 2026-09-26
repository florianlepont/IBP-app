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
  @MaxLength(64)
  region?: string

  // 01.9 D-05: minLng,minLat,maxLng,maxLat, parsed by parseBbox (fixed 400 messages).
  @IsOptional()
  @IsString()
  @MaxLength(128)
  bbox?: string
}
