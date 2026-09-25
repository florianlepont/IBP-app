import { getDb } from "./db"
import { AuthUser } from "../app/types"

// D-13: the last successful /me profile is cached locally so a cold start
// with valid stored credentials but no network can still open the signed-in
// screens. Stored in local_meta beside the survey data it describes (same
// trust tier, RESEARCH V8). Best-effort by design: every function catches
// its own errors so the restore effect can run before App.tsx has finished
// initLocalDb(), and a corrupted or wrong-account value never leaks into the
// auth flow (T-01.5-11).
export const CACHED_PROFILE_KEY = "cached_profile"

type CachedProfileRecord = {
  sub: string
  user: AuthUser
  cached_at: string
}

function isValidAuthUserShape(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.display_name === "string"
  )
}

function parseCachedProfileRecord(raw: string): CachedProfileRecord | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== "object") {
    return null
  }

  const candidate = parsed as Record<string, unknown>
  if (typeof candidate.sub !== "string" || !isValidAuthUserShape(candidate.user)) {
    return null
  }

  return {
    sub: candidate.sub,
    user: candidate.user,
    cached_at: typeof candidate.cached_at === "string" ? candidate.cached_at : "",
  }
}

export async function saveCachedProfile(sub: string, user: AuthUser): Promise<void> {
  try {
    const db = await getDb()
    const now = new Date().toISOString()
    const record: CachedProfileRecord = { sub, user, cached_at: now }

    await db.runAsync(
      `INSERT INTO local_meta (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [CACHED_PROFILE_KEY, JSON.stringify(record), now],
    )
  } catch {
    // Best-effort cache: never let a storage failure break the auth flow.
  }
}

export async function loadCachedProfile(sub: string): Promise<AuthUser | null> {
  try {
    const db = await getDb()
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM local_meta WHERE key = ?`,
      [CACHED_PROFILE_KEY],
    )

    if (!row?.value) {
      return null
    }

    const record = parseCachedProfileRecord(row.value)
    if (!record || record.sub !== sub) {
      return null
    }

    return record.user
  } catch {
    return null
  }
}

export async function clearCachedProfile(): Promise<void> {
  try {
    const db = await getDb()
    await db.runAsync(`DELETE FROM local_meta WHERE key = ?`, [CACHED_PROFILE_KEY])
  } catch {
    // Best-effort cache: never let a storage failure break the auth flow.
  }
}
