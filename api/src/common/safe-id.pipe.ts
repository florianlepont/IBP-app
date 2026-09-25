import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common"
import { isSafeId } from "./safe-id"

// D-14 (replaces the UUID pipe of D-07): survey and attachment ids stay client-chosen TEXT,
// so route params are checked against SAFE_ID_PATTERN instead of a UUID format. The pattern
// accepts every id format the app has ever generated (`survey-<Date.now()>` in early builds,
// `randomUUID()` today, server `randomUUID()` attachment ids, `e2e-survey-<ms>` fixtures).
// The message is fixed so the rejected value is never echoed back.
@Injectable()
export class SafeIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown, _metadata?: ArgumentMetadata): string {
    if (isSafeId(value)) {
      return value
    }
    throw new BadRequestException("Invalid identifier")
  }
}
