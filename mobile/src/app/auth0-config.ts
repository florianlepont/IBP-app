import { fr, logStatusDetail, type StatusMessage } from "../i18n"

const DEFAULT_AUTH0_DOMAIN = "cortege-auth.algernon.ovh"
const DEFAULT_AUTH0_CLIENT_ID = "qaOBdPPo7eIMadCmIq5qDhmEGOqZF6py"
const DEFAULT_AUTH0_AUDIENCE = "https://api.ibp-app"
const IOS_BUNDLE_IDENTIFIER = "fr.etatssauvages.cortege"

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

// The configuration detail goes to the debug console in dev builds only; the
// status line gets catalogue text (phase 01.9 D-06).
export function buildAuth0UnauthorizedMessage(apiUrl: string): StatusMessage {
  logStatusDetail("session.auth0Refused", {
    clientId: AUTH0_CLIENT_ID,
    audience: AUTH0_AUDIENCE,
    iosCallback: AUTH0_IOS_CALLBACK_URL,
    api: apiUrl,
  })
  return fr.status.session.loginRefused()
}

export function buildApiTokenRejectedMessage(apiUrl: string): StatusMessage {
  logStatusDetail("session.apiTokenRejected", { audience: AUTH0_AUDIENCE, api: apiUrl })
  return fr.status.session.loginInterrupted()
}
