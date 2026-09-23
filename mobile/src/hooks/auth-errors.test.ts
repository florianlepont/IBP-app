/**
 * Tests for classifyCredentialsError, isAuthRequiredError and
 * isAuthTemporarilyUnavailableError (mobile audit M-C1 / D-01 / D-01a).
 *
 * "react-native-auth0" is mocked with a minimal CredentialsManagerError class
 * carrying a `.type` string, matching the shape read directly from
 * node_modules/react-native-auth0/src/core/models/CredentialsManagerError.ts.
 */

// Variables starting with "mock" can be referenced inside jest.mock factories
// despite hoisting — this is a Jest-specific allowance.
class MockCredentialsManagerError extends Error {
  type: string
  constructor(type: string) {
    super(`CredentialsManagerError: ${type}`)
    this.type = type
  }
}

jest.mock("react-native-auth0", () => ({
  CredentialsManagerError: MockCredentialsManagerError,
  CredentialsManagerErrorCodes: {
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    NO_CREDENTIALS: "NO_CREDENTIALS",
    NO_REFRESH_TOKEN: "NO_REFRESH_TOKEN",
    RENEW_FAILED: "RENEW_FAILED",
    STORE_FAILED: "STORE_FAILED",
    REVOKE_FAILED: "REVOKE_FAILED",
    LARGE_MIN_TTL: "LARGE_MIN_TTL",
    CREDENTIAL_MANAGER_ERROR: "CREDENTIAL_MANAGER_ERROR",
    BIOMETRICS_FAILED: "BIOMETRICS_FAILED",
    NO_NETWORK: "NO_NETWORK",
    API_ERROR: "API_ERROR",
    API_EXCHANGE_FAILED: "API_EXCHANGE_FAILED",
    INCOMPATIBLE_DEVICE: "INCOMPATIBLE_DEVICE",
    CRYPTO_EXCEPTION: "CRYPTO_EXCEPTION",
    UNKNOWN_ERROR: "UNKNOWN_ERROR",
  },
}))

import {
  AUTH_REQUIRED_ERROR,
  AUTH_TEMPORARILY_UNAVAILABLE_ERROR,
  classifyCredentialsError,
  isAuthRequiredError,
  isAuthTemporarilyUnavailableError,
} from "./auth-errors"

function credErr(type: string): MockCredentialsManagerError {
  return new MockCredentialsManagerError(type)
}

describe("classifyCredentialsError", () => {
  test("NO_NETWORK is retry-later regardless of phase or online state", () => {
    expect(
      classifyCredentialsError(credErr("NO_NETWORK"), { phase: "refresh", isOnline: true }),
    ).toBe("retry-later")
    expect(
      classifyCredentialsError(credErr("NO_NETWORK"), { phase: "restore", isOnline: false }),
    ).toBe("retry-later")
  })

  test("RENEW_FAILED ends the session only when online", () => {
    expect(
      classifyCredentialsError(credErr("RENEW_FAILED"), { phase: "refresh", isOnline: true }),
    ).toBe("session-ended")
    expect(
      classifyCredentialsError(credErr("RENEW_FAILED"), { phase: "restore", isOnline: true }),
    ).toBe("session-ended")
    expect(
      classifyCredentialsError(credErr("RENEW_FAILED"), { phase: "refresh", isOnline: false }),
    ).toBe("retry-later")
    expect(
      classifyCredentialsError(credErr("RENEW_FAILED"), { phase: "restore", isOnline: false }),
    ).toBe("retry-later")
  })

  test("NO_REFRESH_TOKEN always ends the session", () => {
    expect(
      classifyCredentialsError(credErr("NO_REFRESH_TOKEN"), { phase: "refresh", isOnline: true }),
    ).toBe("session-ended")
    expect(
      classifyCredentialsError(credErr("NO_REFRESH_TOKEN"), {
        phase: "restore",
        isOnline: false,
      }),
    ).toBe("session-ended")
  })

  test("NO_CREDENTIALS ends the session only at restore", () => {
    expect(
      classifyCredentialsError(credErr("NO_CREDENTIALS"), { phase: "restore", isOnline: true }),
    ).toBe("session-ended")
    expect(
      classifyCredentialsError(credErr("NO_CREDENTIALS"), { phase: "refresh", isOnline: true }),
    ).toBe("retry-later")
  })

  test.each([
    "INVALID_CREDENTIALS",
    "API_ERROR",
    "UNKNOWN_ERROR",
    "CRYPTO_EXCEPTION",
    "STORE_FAILED",
  ])("%s is retry-later", (type) => {
    expect(classifyCredentialsError(credErr(type), { phase: "refresh", isOnline: true })).toBe(
      "retry-later",
    )
    expect(classifyCredentialsError(credErr(type), { phase: "restore", isOnline: true })).toBe(
      "retry-later",
    )
  })

  test("non-CredentialsManagerError values are retry-later", () => {
    expect(
      classifyCredentialsError(new Error("Network request timed out"), {
        phase: "refresh",
        isOnline: true,
      }),
    ).toBe("retry-later")
    expect(classifyCredentialsError("boom", { phase: "restore", isOnline: false })).toBe(
      "retry-later",
    )
    expect(classifyCredentialsError(undefined, { phase: "refresh", isOnline: true })).toBe(
      "retry-later",
    )
  })
})

describe("isAuthRequiredError", () => {
  test("true for an Error with the AUTH_REQUIRED message", () => {
    expect(isAuthRequiredError(new Error(AUTH_REQUIRED_ERROR))).toBe(true)
  })

  test("false for other errors and non-Errors", () => {
    expect(isAuthRequiredError(new Error("other"))).toBe(false)
    expect(isAuthRequiredError("AUTH_REQUIRED")).toBe(false)
    expect(isAuthRequiredError(undefined)).toBe(false)
  })
})

describe("isAuthTemporarilyUnavailableError", () => {
  test("true for an Error with the AUTH_TEMPORARILY_UNAVAILABLE message", () => {
    expect(isAuthTemporarilyUnavailableError(new Error(AUTH_TEMPORARILY_UNAVAILABLE_ERROR))).toBe(
      true,
    )
  })

  test("false for other errors and non-Errors", () => {
    expect(isAuthTemporarilyUnavailableError(new Error("other"))).toBe(false)
    expect(isAuthTemporarilyUnavailableError(null)).toBe(false)
  })
})
