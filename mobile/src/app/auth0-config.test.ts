describe("auth0-config", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    jest.resetModules()
  })

  test("exposes the default Auth0 configuration", async () => {
    const { AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_DOMAIN, AUTH0_IOS_CALLBACK_URL } =
      await import("./auth0-config")

    expect(AUTH0_DOMAIN).toBe("auth-ibp.algernon.ovh")
    expect(AUTH0_CLIENT_ID).toBe("qaOBdPPo7eIMadCmIq5qDhmEGOqZF6py")
    expect(AUTH0_AUDIENCE).toBe("https://api.ibp-app")
    expect(AUTH0_IOS_CALLBACK_URL).toBe(
      "fr.etats-sauvages.ibp-app.auth0://auth-ibp.algernon.ovh/ios/fr.etats-sauvages.ibp-app/callback",
    )
  })

  test("builds a detailed Auth0 unauthorized message", async () => {
    const {
      AUTH0_AUDIENCE,
      AUTH0_CLIENT_ID,
      AUTH0_IOS_CALLBACK_URL,
      buildAuth0UnauthorizedMessage,
    } = await import("./auth0-config")
    const message = buildAuth0UnauthorizedMessage("https://api.algernon.ovh/v1")

    expect(message).toContain("Auth0 a refuse la connexion")
    expect(message).toContain(AUTH0_CLIENT_ID)
    expect(message).toContain(AUTH0_AUDIENCE)
    expect(message).toContain(AUTH0_IOS_CALLBACK_URL)
    expect(message).toContain("https://api.algernon.ovh/v1")
  })

  test("builds a detailed API token rejection message", async () => {
    const { AUTH0_AUDIENCE, buildApiTokenRejectedMessage } = await import("./auth0-config")
    const message = buildApiTokenRejectedMessage("https://api.algernon.ovh/v1")

    expect(message).toContain("Connexion Auth0 reussie")
    expect(message).toContain(AUTH0_AUDIENCE)
    expect(message).toContain("AUTH0_PUBLIC_DOMAIN / AUTH0_DOMAIN")
    expect(message).toContain("https://api.algernon.ovh/v1")
  })
  test("uses EXPO public values when provided", async () => {
    process.env = {
      ...originalEnv,
      EXPO_PUBLIC_AUTH0_DOMAIN: "auth.example.com",
      EXPO_PUBLIC_AUTH0_CLIENT_ID: "client-id",
      EXPO_PUBLIC_AUTH0_AUDIENCE: "https://api.example.com",
    }
    jest.resetModules()

    const { auth0Config } = await import("./auth0-config")

    expect(auth0Config).toEqual({
      domain: "auth.example.com",
      clientId: "client-id",
      audience: "https://api.example.com",
    })
  })
})
