describe("auth0-config", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    jest.resetModules()
  })

  test("exposes the default Auth0 configuration", async () => {
    const { AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_DOMAIN, AUTH0_IOS_CALLBACK_URL } =
      await import("./auth0-config")

    expect(AUTH0_DOMAIN).toBe("cortege-auth.algernon.ovh")
    expect(AUTH0_CLIENT_ID).toBe("qaOBdPPo7eIMadCmIq5qDhmEGOqZF6py")
    expect(AUTH0_AUDIENCE).toBe("https://api.ibp-app")
    expect(AUTH0_IOS_CALLBACK_URL).toBe(
      "fr.etatssauvages.cortege.auth0://cortege-auth.algernon.ovh/ios/fr.etatssauvages.cortege/callback",
    )
  })

  test("returns catalogue text for an Auth0 refusal and logs the configuration in dev", async () => {
    const debug = jest.spyOn(console, "debug").mockImplementation(() => undefined)
    const {
      AUTH0_AUDIENCE,
      AUTH0_CLIENT_ID,
      AUTH0_IOS_CALLBACK_URL,
      buildAuth0UnauthorizedMessage,
    } = await import("./auth0-config")
    const { fr } = await import("../i18n")
    const message = buildAuth0UnauthorizedMessage("https://cortege.algernon.ovh/v1")

    expect(message).toBe(fr.status.session.loginRefused())
    expect(message).not.toContain(AUTH0_CLIENT_ID)
    expect(debug).toHaveBeenCalledWith("[status] session.auth0Refused", {
      clientId: AUTH0_CLIENT_ID,
      audience: AUTH0_AUDIENCE,
      iosCallback: AUTH0_IOS_CALLBACK_URL,
      api: "https://cortege.algernon.ovh/v1",
    })
    debug.mockRestore()
  })

  test("returns catalogue text for an API token refusal and logs the target in dev", async () => {
    const debug = jest.spyOn(console, "debug").mockImplementation(() => undefined)
    const { AUTH0_AUDIENCE, buildApiTokenRejectedMessage } = await import("./auth0-config")
    const { fr } = await import("../i18n")
    const message = buildApiTokenRejectedMessage("https://cortege.algernon.ovh/v1")

    expect(message).toBe(fr.status.session.loginInterrupted())
    expect(message).not.toContain(AUTH0_AUDIENCE)
    expect(debug).toHaveBeenCalledWith("[status] session.apiTokenRejected", {
      audience: AUTH0_AUDIENCE,
      api: "https://cortege.algernon.ovh/v1",
    })
    debug.mockRestore()
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
