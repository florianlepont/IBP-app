import { IsOptional, IsString, MaxLength } from "class-validator"

export class PublicParcelStatusesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  bbox?: string

  @IsOptional()
  @IsString()
  @MaxLength(8)
  zoom?: string

  @IsOptional()
  @IsString()
  @MaxLength(8)
  year?: string
}
