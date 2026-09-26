export type IdTokenClaims = {
  sub: string
  email: string | null
}

/**
 * Decodes the `sub` and `email` claims out of an Auth0 ID token's payload
 * segment, WITHOUT verifying its signature.
 *
 * This is intentional: the token comes straight from the Auth0 SDK's secure
 * store (react-native-auth0's credentialsManager), and the claims are used
 * only to label which account owns local data (the D-04 "local data owned by
 * another account" check) — never to make an authorization decision. Every
 * access token the app sends to the API is still verified server-side against
 * Auth0's JWKS.
 */
export function extractIdTokenClaims(idToken: string | null | undefined): IdTokenClaims | null {
  if (!idToken) return null

  try {
    const segments = idToken.split(".")
    if (segments.length < 3) return null

    const payloadSegment = segments[1]
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    const utf8 = decodeURIComponent(
      Array.from(binary)
        .map((char) => "%" + char.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    )

    const payload = JSON.parse(utf8) as { sub?: unknown; email?: unknown }
    if (typeof payload.sub !== "string" || payload.sub.length === 0) return null

    const email = typeof payload.email === "string" ? payload.email : null
    return { sub: payload.sub, email }
  } catch {
    return null
  }
}
