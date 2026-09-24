import { BadRequestException } from "@nestjs/common"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"

// D-02/D-12: every sync operation envelope and payload is validated by a
// class DTO. Unknown fields are stripped (whitelist), never rejected
// (forbidNonWhitelisted: false), so installed apps and old fixtures keep
// syncing; type/format violations on known fields are still fatal. On
// failure only property names are surfaced (never values or constraint
// text) so the client never sees raw internals (D-02 generic message).
export async function validateSyncDto<T extends object>(
  cls: new () => T,
  value: unknown,
): Promise<T> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException({
      code: "invalid_sync_operation",
      message: "Invalid sync operation",
      details: { fields: [] },
    })
  }

  const instance = plainToInstance(cls, value)
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: false,
    forbidUnknownValues: true,
  })

  if (errors.length > 0) {
    const fields = Array.from(new Set(errors.map((error) => error.property)))
    throw new BadRequestException({
      code: "invalid_sync_operation",
      message: "Invalid sync operation",
      details: { fields },
    })
  }

  return instance
}
