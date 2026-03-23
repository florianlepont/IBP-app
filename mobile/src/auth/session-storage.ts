import * as SecureStore from "expo-secure-store"

const SESSION_KEY = "ibp_auth_session_v1"

export type StoredAuthSession = {
  accessToken: string
  refreshToken: string
}

export async function loadStoredAuthSession(): Promise<StoredAuthSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>
    if (!parsed || typeof parsed !== "object") {
      return null
    }

    if (typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string") {
      return null
    }

    if (!parsed.refreshToken.trim()) {
      return null
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
    }
  } catch {
    return null
  }
}

export async function saveStoredAuthSession(session: StoredAuthSession): Promise<void> {
  if (!session?.refreshToken?.trim()) {
    await SecureStore.deleteItemAsync(SESSION_KEY)
    return
  }

  await SecureStore.setItemAsync(
    SESSION_KEY,
    JSON.stringify({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    }),
  )
}

export async function clearStoredAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY)
}
