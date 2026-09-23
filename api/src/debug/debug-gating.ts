/**
 * D-07 (audit finding A-H4): DebugModule and its HS256 test-token minting path
 * must not exist in production. CI runs the whole E2E suite with NODE_ENV=test
 * (see .github/workflows/ci.yml), so this predicate must stay exactly
 * `NODE_ENV !== "production"` — no new environment variable may be required,
 * or the E2E suite's token acquisition (`POST /v1/debug/test-token`) breaks.
 *
 * This is the outer layer of a defense-in-depth stack; the inner layers are
 * untouched by this gate:
 * - debug.controller.ts's own `if (process.env.NODE_ENV !== "test") throw new ForbiddenException()`
 *   inside POST test-token
 * - debug.service.ts's `DEBUG_DATA_RESET_ENABLED === "true"` check on the reset endpoints
 * - auth.guard.ts's HS256 branch, which only runs when `process.env.NODE_ENV === "test"`
 */
export function isDebugSurfaceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production"
}
