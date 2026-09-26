import { currentNodeEnv } from "../config/app-config"

/**
 * D-07 (audit finding A-H4): DebugModule and its HS256 test-token minting path
 * must not exist in production. CI runs the whole E2E suite with NODE_ENV=test
 * (see .github/workflows/ci.yml), so this predicate must stay exactly
 * `nodeEnv !== "production"` — no new environment variable may be required,
 * or the E2E suite's token acquisition (`POST /v1/debug/test-token`) breaks.
 * It is evaluated at decorator time (AppModule imports), so the default reads
 * NODE_ENV through `currentNodeEnv()` rather than ConfigService (D-01).
 *
 * This is the outer layer of a defense-in-depth stack; the inner layers are
 * untouched by this gate:
 * - debug.controller.ts's own `if (this.nodeEnv !== "test") throw new ForbiddenException()`
 *   inside POST test-token (config nodeEnv), signing with `getTestTokenSecret`, which
 *   returns null outside test (D-04)
 * - debug.service.ts's `debug.dataResetEnabled` (DEBUG_DATA_RESET_ENABLED) check on the
 *   reset endpoints
 * - auth.guard.ts's HS256 branch, which only runs when the config nodeEnv is "test" and
 *   verifies with the same `getTestTokenSecret`
 */
export function isDebugSurfaceEnabled(nodeEnv: string = currentNodeEnv()): boolean {
  return nodeEnv !== "production"
}
