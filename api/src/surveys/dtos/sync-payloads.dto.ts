import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator"

export class SurveyDeletePayloadDto {
  @IsOptional()
  @IsString()
  id?: string
}

export class AttachmentDeletePayloadDto {
  @IsString()
  @IsNotEmpty()
  attachment_id!: string
}

export class SurveyVisibilityPayloadDto {
  @IsIn(["private", "public"])
  visibility!: "private" | "public"
}
