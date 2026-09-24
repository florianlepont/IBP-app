import { getDb } from "./db"
import { UnsyncedLocalWork } from "../app/local-data-owner"

export const LOCAL_OWNER_SUB_KEY = "session_owner_sub"
export const LOCAL_OWNER_EMAIL_KEY = "session_owner_email"

export async function getLocalDataOwner(): Promise<{ sub: string; email: string | null } | null> {
  const db = await getDb()

  const subRow = await db.getFirstAsync<{ value: string }>(
    `SELECT value
     FROM local_meta
     WHERE key = ?`,
    [LOCAL_OWNER_SUB_KEY],
  )

  if (!subRow?.value) {
    return null
  }

  const emailRow = await db.getFirstAsync<{ value: string }>(
    `SELECT value
     FROM local_meta
     WHERE key = ?`,
    [LOCAL_OWNER_EMAIL_KEY],
  )

  return { sub: subRow.value, email: emailRow?.value ?? null }
}

export async function setLocalDataOwner(owner: {
  sub: string
  email: string | null
}): Promise<void> {
  const db = await getDb()
  const now = new Date().toISOString()

  await db.runAsync(
    `INSERT INTO local_meta (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [LOCAL_OWNER_SUB_KEY, owner.sub, now],
  )

  if (owner.email) {
    await db.runAsync(
      `INSERT INTO local_meta (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [LOCAL_OWNER_EMAIL_KEY, owner.email, now],
    )
  } else {
    await db.runAsync(`DELETE FROM local_meta WHERE key = ?`, [LOCAL_OWNER_EMAIL_KEY])
  }
}

export async function countUnsyncedLocalWork(): Promise<UnsyncedLocalWork> {
  const db = await getDb()

  const surveysRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM local_surveys
     WHERE sync_state != 'synced'
        OR sync_blocked = 1
        OR id IN (SELECT survey_id FROM sync_queue)`,
  )

  const attachmentsRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM local_attachments
     WHERE sync_state != 'synced'`,
  )

  // A queued survey delete removes the local_surveys row immediately and
  // leaves only its sync_queue entry, so the query above cannot see it.
  const deletionsRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT survey_id) AS count
     FROM sync_queue
     WHERE survey_id NOT IN (SELECT id FROM local_surveys)`,
  )

  return {
    surveys: Number(surveysRow?.count ?? 0),
    attachments: Number(attachmentsRow?.count ?? 0),
    deletions: Number(deletionsRow?.count ?? 0),
  }
}
