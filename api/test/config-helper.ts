import { ConfigService } from "@nestjs/config"
import { loadAppConfig } from "../src/config/app-config"
import { AppConfig } from "../src/config/config.types"

/**
 * Typed configuration for specs that construct services by hand (pattern map
 * C-6): NODE_ENV=test plus the given overrides, on top of the current env.
 * Specs pass config objects instead of mutating process.env.
 */
export function buildTestConfig(overrides: Record<string, string | undefined> = {}): AppConfig {
  return loadAppConfig({ ...process.env, NODE_ENV: "test", ...overrides })
}

/** A ConfigService for which `appConfigOf(service)` returns `buildTestConfig(overrides)`. */
export function buildTestConfigService(
  overrides: Record<string, string | undefined> = {},
): ConfigService {
  return new ConfigService({ app: buildTestConfig(overrides) })
}
