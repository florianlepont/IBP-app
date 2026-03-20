import * as SecureStore from "expo-secure-store"

const API_URL_KEY = "ibp_api_url_v1"

export async function loadStoredApiUrl(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(API_URL_KEY)
    if (!raw) return null
    const value = raw.trim()
    return value.length > 0 ? value : null
  } catch {
    return null
  }
}

export async function saveStoredApiUrl(value: string): Promise<void> {
  const trimmed = value.trim()
  if (!trimmed) {
    await SecureStore.deleteItemAsync(API_URL_KEY)
    return
  }
  await SecureStore.setItemAsync(API_URL_KEY, trimmed)
}
