import {
  AUTH0_AUDIENCE,
  AUTH0_CLIENT_ID,
  AUTH0_DOMAIN,
  AUTH0_IOS_CALLBACK_URL,
  buildApiTokenRejectedMessage,
  buildAuth0UnauthorizedMessage,
} from "./auth0-config"

describe("auth0-config", () => {
  test("exposes the default Auth0 configuration", () => {
    expect(AUTH0_DOMAIN).toBe("auth-ibp.algernon.ovh")
    expect(AUTH0_CLIENT_ID).toBe("qaOBdPPo7eIMadCmIq5qDhmEGOqZF6py")
    expect(AUTH0_AUDIENCE).toBe("https://api.ibp-app")
    expect(AUTH0_IOS_CALLBACK_URL).toBe(
      "fr.etats-sauvages.ibp-app.auth0://auth-ibp.algernon.ovh/ios/fr.etats-sauvages.ibp-app/callback",
    )
  })

  test("builds a detailed Auth0 unauthorized message", () => {
    const message = buildAuth0UnauthorizedMessage("https://api.algernon.ovh/v1")

    expect(message).toContain("Auth0 a refuse la connexion")
    expect(message).toContain(AUTH0_CLIENT_ID)
    expect(message).toContain(AUTH0_AUDIENCE)
    expect(message).toContain(AUTH0_IOS_CALLBACK_URL)
    expect(message).toContain("https://api.algernon.ovh/v1")
  })

  test("builds a detailed API token rejection message", () => {
    const message = buildApiTokenRejectedMessage("https://api.algernon.ovh/v1")

    expect(message).toContain("Connexion Auth0 reussie")
    expect(message).toContain(AUTH0_AUDIENCE)
    expect(message).toContain("AUTH0_PUBLIC_DOMAIN / AUTH0_DOMAIN")
    expect(message).toContain("https://api.algernon.ovh/v1")
  })
})
