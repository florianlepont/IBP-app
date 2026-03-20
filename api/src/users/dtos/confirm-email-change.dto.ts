import { IsOptional, IsString } from "class-validator"

export class ConfirmEmailChangeDto {
  @IsOptional()
  @IsString()
  token?: string
}
