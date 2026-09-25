import { randomBytes } from "crypto"

let secret: string | null = null

/**
 * D-04: the HS256 secret shared by POST /v1/debug/test-token and the AuthGuard
 * test branch. It is random, generated once per process (per module instance)
 * and never read from the environment, so there is no shared or guessable
 * secret to leak or misconfigure. The E2E suites and the owner-check
 * simulation mint their tokens through the same running process, so they keep
 * working unchanged.
 *
 * Returns null outside NODE_ENV=test: no caller can obtain a signing secret in
 * development or production.
 *
 * jest.isolateModulesAsync gets its own module registry, hence its own secret.
 * That is fine: the app and its guard are loaded from the same registry and so
 * share it.
 */
export function getTestTokenSecret(nodeEnv: string): string | null {
  if (nodeEnv !== "test") {
    return null
  }
  if (secret === null) {
    secret = randomBytes(32).toString("hex")
  }
  return secret
}
