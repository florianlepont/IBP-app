import { IsString, MinLength } from "class-validator"

export class VerifyEmailDto {
  @IsString()
  @MinLength(1)
  token!: string
}
