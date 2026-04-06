const FALLBACK_AUTH0_DOMAIN = "dev-zocy4q27tkkmjkmd.eu.auth0.com"
const FALLBACK_AUTH0_CLIENT_ID = "qaOBdPPo7eIMadCmIq5qDhmEGOqZF6py"
const FALLBACK_AUTH0_AUDIENCE = "https://api.ibp-app"

const resolveConfigValue = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

export const auth0Config = {
  domain: resolveConfigValue(process.env.EXPO_PUBLIC_AUTH0_DOMAIN, FALLBACK_AUTH0_DOMAIN),
  clientId: resolveConfigValue(process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID, FALLBACK_AUTH0_CLIENT_ID),
  audience: resolveConfigValue(process.env.EXPO_PUBLIC_AUTH0_AUDIENCE, FALLBACK_AUTH0_AUDIENCE),
}
