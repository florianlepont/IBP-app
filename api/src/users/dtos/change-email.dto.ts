import { IsEmail } from "class-validator"

export class ChangeEmailDto {
  @IsEmail()
  email!: string
}
