import { IsIn, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator"
import { SAFE_ID_PATTERN } from "../../common/safe-id"

// D-14: ids that can reach a storage key must match the safe-id pattern.
export class SurveyDeletePayloadDto {
  @IsOptional()
  @IsString()
  @Matches(SAFE_ID_PATTERN)
  id?: string
}

export class AttachmentDeletePayloadDto {
  @IsString()
  @IsNotEmpty()
  @Matches(SAFE_ID_PATTERN)
  attachment_id!: string
}

export class SurveyVisibilityPayloadDto {
  @IsIn(["private", "public"])
  visibility!: "private" | "public"
}
