import { IsOptional, IsString } from 'class-validator'

export class RegisterDto {
  @IsOptional()
  @IsString()
  email?: string

  @IsOptional()
  @IsString()
  password?: string

  @IsOptional()
  @IsString()
  display_name?: string
}
