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

export const LEGAL_TERMS_URL = "https://etats-sauvages.fr/cgu"
export const LEGAL_PRIVACY_URL = "https://etats-sauvages.fr/confidentialite"

export function buildAuth0UnauthorizedMessage(apiUrl: string): string {
  if (__DEV__) {
    return [
      "[DEV] Auth0 a refusé la connexion.",
      `Client: ${AUTH0_CLIENT_ID}`,
      `Audience: ${AUTH0_AUDIENCE}`,
      `Callback iOS: ${AUTH0_IOS_CALLBACK_URL}`,
      `API: ${apiUrl}`,
    ].join("\n")
  }
  return "La connexion a échoué. Vérifiez votre connexion internet et réessayez."
}

export function buildApiTokenRejectedMessage(apiUrl: string): string {
  if (__DEV__) {
    return [
      "[DEV] Auth0 OK, mais l'API a refusé le token.",
      `Audience attendue: ${AUTH0_AUDIENCE}`,
      `API cible: ${apiUrl}`,
    ].join("\n")
  }
  return "Connexion interrompue. Veuillez réessayer."
}
