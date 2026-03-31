const mockGetItemAsync = jest.fn()
const mockDeleteItemAsync = jest.fn()
const mockSetItemAsync = jest.fn()

jest.mock("expo-secure-store", () => ({
  getItemAsync: mockGetItemAsync,
  deleteItemAsync: mockDeleteItemAsync,
  setItemAsync: mockSetItemAsync,
}))

import { loadStoredApiUrl, saveStoredApiUrl } from "./api-url-storage"

describe("loadStoredApiUrl", () => {
  beforeEach(() => jest.clearAllMocks())

  test("returns null when nothing is stored", async () => {
    mockGetItemAsync.mockResolvedValue(null)
    expect(await loadStoredApiUrl()).toBeNull()
  })

  test("returns trimmed value", async () => {
    mockGetItemAsync.mockResolvedValue("  http://192.168.1.1:3000  ")
    expect(await loadStoredApiUrl()).toBe("http://192.168.1.1:3000")
  })

  test("returns null for whitespace-only string", async () => {
    mockGetItemAsync.mockResolvedValue("   ")
    expect(await loadStoredApiUrl()).toBeNull()
  })

  test("returns null when SecureStore throws", async () => {
    mockGetItemAsync.mockRejectedValue(new Error("SecureStore unavailable"))
    expect(await loadStoredApiUrl()).toBeNull()
  })

  test("returns the raw value for a valid URL", async () => {
    mockGetItemAsync.mockResolvedValue("http://localhost:3000/v1")
    expect(await loadStoredApiUrl()).toBe("http://localhost:3000/v1")
  })
})

describe("saveStoredApiUrl", () => {
  beforeEach(() => jest.clearAllMocks())

  test("saves trimmed value to SecureStore", async () => {
    mockSetItemAsync.mockResolvedValue(undefined)
    await saveStoredApiUrl("  http://localhost:3000  ")
    expect(mockSetItemAsync).toHaveBeenCalledWith("ibp_api_url_v1", "http://localhost:3000")
    expect(mockDeleteItemAsync).not.toHaveBeenCalled()
  })

  test("deletes the key when value is empty string", async () => {
    mockDeleteItemAsync.mockResolvedValue(undefined)
    await saveStoredApiUrl("")
    expect(mockDeleteItemAsync).toHaveBeenCalled()
    expect(mockSetItemAsync).not.toHaveBeenCalled()
  })

  test("deletes the key when value is whitespace only", async () => {
    mockDeleteItemAsync.mockResolvedValue(undefined)
    await saveStoredApiUrl("   ")
    expect(mockDeleteItemAsync).toHaveBeenCalled()
    expect(mockSetItemAsync).not.toHaveBeenCalled()
  })
})
