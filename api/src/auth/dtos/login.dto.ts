import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class LoginDto {
  @IsOptional()
  @IsString()
  email?: string

  @IsOptional()
  @IsString()
  password?: string

  @IsOptional()
  @IsBoolean()
  create_if_missing?: boolean
}
