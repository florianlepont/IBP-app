import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateAttachmentDto {
  @IsOptional()
  @IsString()
  mime_type?: string

  @IsOptional()
  @IsNumber()
  size_bytes?: number

  @IsOptional()
  @IsString()
  captured_at?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
