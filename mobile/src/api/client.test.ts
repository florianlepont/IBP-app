import { apiRequest } from "./client"

type MockResponse = {
  ok: boolean
  status: number
  text: () => Promise<string>
}

describe("apiRequest", () => {
  const originalFetch = global.fetch
  const originalTimeout = process.env.EXPO_PUBLIC_API_TIMEOUT_MS

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = originalTimeout
  })

  afterAll(() => {
    global.fetch = originalFetch
    process.env.EXPO_PUBLIC_API_TIMEOUT_MS = originalTimeout
  })

  it("normalizes the base URL, adds headers and returns parsed JSON", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    } satisfies MockResponse) as typeof global.fetch

    const result = await apiRequest<{ ok: boolean }>({
      baseUrl: "https://api.example.com///",
      path: "/auth/login",
      method: "POST",
      token: "access-token",
      json: { email: "user@example.com" },
    })

    expect(result).toEqual({ ok: true })
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.example.com/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "user@example.com" }),
      }),
    )
  })

  it("throws an ApiError with the parsed server message on HTTP errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "Forbidden access" }),
    } satisfies MockResponse) as typeof global.fetch

    await expect(
      apiRequest({
        baseUrl: "https://api.example.com",
        path: "/me",
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: "Forbidden access",
      body: { message: "Forbidden access" },
    })
  })

  it("returns undefined when JSON parsing is disabled", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => "",
    } satisfies MockResponse) as typeof global.fetch

    await expect(
      apiRequest({
        baseUrl: "https://api.example.com",
        path: "/auth/logout",
        method: "POST",
        expectJson: false,
      }),
    ).resolves.toBeUndefined()
  })

  it("maps abort errors to a timeout ApiError", async () => {
    global.fetch = jest.fn().mockRejectedValue({ name: "AbortError" }) as typeof global.fetch

    await expect(
      apiRequest({
        baseUrl: "https://api.example.com",
        path: "/slow",
        timeoutMs: 50,
      }),
    ).rejects.toMatchObject({
      status: 408,
      message: "Request timeout after 50ms",
      body: null,
    })
  })
})
