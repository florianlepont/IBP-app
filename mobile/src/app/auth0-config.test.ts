describe("auth0Config", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    jest.resetModules()
  })

  it("uses EXPO public values when provided", async () => {
    process.env = {
      ...originalEnv,
      EXPO_PUBLIC_AUTH0_DOMAIN: "auth.example.com",
      EXPO_PUBLIC_AUTH0_CLIENT_ID: "client-id",
      EXPO_PUBLIC_AUTH0_AUDIENCE: "https://api.example.com",
    }

    const { auth0Config } = await import("./auth0-config")

    expect(auth0Config).toEqual({
      domain: "auth.example.com",
      clientId: "client-id",
      audience: "https://api.example.com",
    })
  })

  it("falls back to built-in defaults when env is missing", async () => {
    process.env = { ...originalEnv }
    delete process.env.EXPO_PUBLIC_AUTH0_DOMAIN
    delete process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID
    delete process.env.EXPO_PUBLIC_AUTH0_AUDIENCE

    const { auth0Config } = await import("./auth0-config")

    expect(auth0Config).toEqual({
      domain: "dev-zocy4q27tkkmjkmd.eu.auth0.com",
      clientId: "qaOBdPPo7eIMadCmIq5qDhmEGOqZF6py",
      audience: "https://api.ibp-app",
    })
  })
})
