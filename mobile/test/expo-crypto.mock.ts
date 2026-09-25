import { randomUUID as nodeRandomUUID } from "node:crypto"

// randomUUID is backed by node:crypto so multi-insert tests get real, unique
// v4 UUIDs instead of colliding on a PRIMARY KEY. jest.fn() lets a test
// override the implementation when it needs a deterministic value.
export const randomUUID = jest.fn((): string => nodeRandomUUID())
