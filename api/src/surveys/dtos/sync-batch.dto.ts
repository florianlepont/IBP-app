import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator"
import { SAFE_ID_PATTERN } from "../../common/safe-id"

// D-02: the batch array bounds are validated here, at the controller. Items
// are kept as `unknown[]` on purpose — no nested-object decorator that would
// fail the whole batch on one bad operation. Each item is validated
// individually inside syncBatch via SyncOperationEnvelopeDto.
export class SyncBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  operations!: unknown[]
}

export class SyncOperationEnvelopeDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  client_ref?: string

  @IsIn(["survey", "attachment"])
  entity!: "survey" | "attachment"

  @IsIn(["upsert", "create", "delete", "visibility_update"])
  action!: "upsert" | "create" | "delete" | "visibility_update"

  // D-14: survey_id bypasses the route pipes, so the safe-id pattern is checked here.
  @IsOptional()
  @IsString()
  @Matches(SAFE_ID_PATTERN)
  @MaxLength(128)
  survey_id?: string

  @IsOptional()
  @Allow()
  payload?: unknown
}
