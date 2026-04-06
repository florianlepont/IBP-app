const DEFAULT_AUTH0_DOMAIN = "auth-ibp.algernon.ovh"
const DEFAULT_AUTH0_CLIENT_ID = "qaOBdPPo7eIMadCmIq5qDhmEGOqZF6py"
const DEFAULT_AUTH0_AUDIENCE = "https://api.ibp-app"
const IOS_BUNDLE_IDENTIFIER = "fr.etats-sauvages.ibp-app"

function resolvePublicEnv(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : fallback
}

export const AUTH0_DOMAIN = resolvePublicEnv(
  process.env.EXPO_PUBLIC_AUTH0_DOMAIN,
  DEFAULT_AUTH0_DOMAIN,
)

export const AUTH0_CLIENT_ID = resolvePublicEnv(
  process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID,
  DEFAULT_AUTH0_CLIENT_ID,
)

export const AUTH0_AUDIENCE = resolvePublicEnv(
  process.env.EXPO_PUBLIC_AUTH0_AUDIENCE,
  DEFAULT_AUTH0_AUDIENCE,
)

export const auth0Config = {
  domain: AUTH0_DOMAIN,
  clientId: AUTH0_CLIENT_ID,
  audience: AUTH0_AUDIENCE,
}

export const AUTH0_IOS_CALLBACK_URL = `${IOS_BUNDLE_IDENTIFIER}.auth0://${AUTH0_DOMAIN}/ios/${IOS_BUNDLE_IDENTIFIER}/callback`

export function buildAuth0UnauthorizedMessage(apiUrl: string): string {
  return [
    "Auth0 a refuse la connexion avant l'appel a l'API.",
    `Verifier le client mobile ${AUTH0_CLIENT_ID} et l'audience ${AUTH0_AUDIENCE}.`,
    `Callback iOS attendu: ${AUTH0_IOS_CALLBACK_URL}`,
    `API cible: ${apiUrl}`,
  ].join("\n")
}

export function buildApiTokenRejectedMessage(apiUrl: string): string {
  return [
    "Connexion Auth0 reussie, mais l'API a refuse le token.",
    `Verifier AUTH0_AUDIENCE=${AUTH0_AUDIENCE} sur l'API.`,
    "Verifier aussi AUTH0_PUBLIC_DOMAIN / AUTH0_DOMAIN si l'app utilise un domaine Auth0 public.",
    `API cible: ${apiUrl}`,
  ].join("\n")
}
