/**
 * Tests for transaction.ts — the module-level runInTransaction primitive
 * (D-17) — and for deriveQueueOpType in utils.ts, against real SQL delivered
 * by the global expo-sqlite mock (mobile/test/expo-sqlite.mock.ts), the same
 * strategy as src/storage.test.ts.
 */

import { initLocalDb, getDb } from "./db"
import { runInTransaction, TRANSACTION_WAIT_TIMEOUT_MS, TxHandle } from "./transaction"
import { deriveQueueOpType } from "./utils"

async function insertMeta(tx: TxHandle, key: string, value: string): Promise<void> {
  await tx.runAsync(`INSERT INTO local_meta (key, value, updated_at) VALUES (?, ?, ?)`, [
    key,
    value,
    "2026-01-01T00:00:00.000Z",
  ])
}

async function metaValue(key: string): Promise<string | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM local_meta WHERE key = ?`,
    [key],
  )
  return row?.value ?? null
}

beforeAll(async () => {
  await initLocalDb()
})

beforeEach(async () => {
  const db = await getDb()
  await db.execAsync(`
    DELETE FROM local_surveys;
    DELETE FROM sync_queue;
    DELETE FROM local_attachments;
    DELETE FROM local_meta;
  `)
})

describe("runInTransaction", () => {
  test("resolves with the callback's value and its writes are visible afterwards", async () => {
    const result = await runInTransaction(async (tx) => {
      await insertMeta(tx, "k1", "v1")
      return 42
    })

    expect(result).toBe(42)
    expect(await metaValue("k1")).toBe("v1")
  })

  test("rolls back a first insert and rethrows the same error when the callback throws", async () => {
    const boom = new Error("boom")

    await expect(
      runInTransaction(async (tx) => {
        await insertMeta(tx, "k2", "v2")
        throw boom
      }),
    ).rejects.toBe(boom)

    expect(await metaValue("k2")).toBeNull()
  })

  test("does not interleave two concurrent transactions", async () => {
    const log: string[] = []

    const first = runInTransaction(async (tx) => {
      log.push("A1")
      await insertMeta(tx, "a", "1")
      log.push("A2")
    })
    const second = runInTransaction(async (tx) => {
      log.push("B1")
      await insertMeta(tx, "b", "1")
      log.push("B2")
    })

    await Promise.all([first, second])

    expect(log).toEqual(["A1", "A2", "B1", "B2"])
  })

  test("a failed transaction does not wedge the mutex: the next call runs and commits", async () => {
    await expect(
      runInTransaction(async () => {
        throw new Error("first fails")
      }),
    ).rejects.toThrow("first fails")

    await runInTransaction(async (tx) => {
      await insertMeta(tx, "after-failure", "ok")
    })

    expect(await metaValue("after-failure")).toBe("ok")
  })

  test("the callback receives a TxHandle distinct from getDb(), reaching the same database", async () => {
    const db = await getDb()

    await runInTransaction(async (tx) => {
      expect(tx).not.toBe(db)
      await insertMeta(tx, "handle-check", "same-db")
    })

    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM local_meta WHERE key = 'handle-check'`,
    )
    expect(row?.value).toBe("same-db")
  })

  test("joins the current transaction via an explicit handle, and a later rollback undoes both writes", async () => {
    const err = new Error("outer fails after join")

    await expect(
      runInTransaction(async (tx) => {
        await insertMeta(tx, "outer", "o")

        await runInTransaction(async (innerTx) => {
          expect(innerTx).toBe(tx)
          await insertMeta(innerTx, "inner", "i")
        }, tx)

        throw err
      }),
    ).rejects.toBe(err)

    expect(await metaValue("outer")).toBeNull()
    expect(await metaValue("inner")).toBeNull()
  })

  test("a dead handle throws on direct use and when passed back into runInTransaction", async () => {
    let captured: TxHandle | null = null

    await runInTransaction(async (tx) => {
      captured = tx
      await insertMeta(tx, "captured", "x")
    })

    const deadTx = captured as unknown as TxHandle
    expect(() => deadTx.runAsync(`SELECT 1`)).toThrow(
      "transaction handle used after the transaction ended",
    )

    await expect(runInTransaction(async () => {}, deadTx)).rejects.toThrow(
      "transaction handle used after the transaction ended",
    )
  })

  test("an unguarded nested call rejects after the wait timeout without wedging the outer transaction", async () => {
    jest.useFakeTimers()
    try {
      let innerError: Error | null = null

      const outer = runInTransaction(async (tx) => {
        await insertMeta(tx, "outer2", "o")
        try {
          await runInTransaction(async () => {})
        } catch (error) {
          innerError = error as Error
        }
      })

      await jest.advanceTimersByTimeAsync(TRANSACTION_WAIT_TIMEOUT_MS)
      await outer

      expect(innerError).not.toBeNull()
      expect((innerError as unknown as Error).message).toBe("runInTransaction called reentrantly")

      await runInTransaction(async (tx) => {
        await insertMeta(tx, "later", "l")
      })

      expect(await metaValue("later")).toBe("l")
    } finally {
      jest.useRealTimers()
    }
  })

  test("an unrelated concurrent call waits for the running transaction and commits normally", async () => {
    let resolveGate: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      resolveGate = resolve
    })

    const first = runInTransaction(async (tx) => {
      await gate
      await insertMeta(tx, "first", "f")
    })
    const second = runInTransaction(async (tx) => {
      await insertMeta(tx, "second", "s")
    })

    resolveGate()
    await expect(Promise.all([first, second])).resolves.toBeDefined()

    expect(await metaValue("first")).toBe("f")
    expect(await metaValue("second")).toBe("s")
  })
})

describe("deriveQueueOpType", () => {
  test("maps each of the five payload kinds", () => {
    expect(
      deriveQueueOpType({
        kind: "attachment_upload",
        local_attachment_id: "att-1",
        survey_id: "survey-1",
      }),
    ).toBe("attachment_upload")

    expect(
      deriveQueueOpType({
        kind: "attachment_delete",
        survey_id: "survey-1",
        attachment_id: "remote-1",
      }),
    ).toBe("attachment_delete")

    expect(deriveQueueOpType({ kind: "survey_delete", survey_id: "survey-1" })).toBe(
      "survey_delete",
    )

    expect(
      deriveQueueOpType({
        kind: "survey_visibility_update",
        survey_id: "survey-1",
        visibility: "private",
      }),
    ).toBe("survey_visibility")

    expect(deriveQueueOpType({ id: "survey-1", sync_version: 1, site_name: "Site" })).toBe(
      "survey_upsert",
    )
  })

  test("returns unknown for unrecognised payloads", () => {
    expect(deriveQueueOpType(null)).toBe("unknown")
    expect(deriveQueueOpType("garbage")).toBe("unknown")
    expect(deriveQueueOpType({})).toBe("unknown")
    expect(deriveQueueOpType({ kind: "other" })).toBe("unknown")
  })
})

// The three assertions below only go green once Task 2 lands the migration
// runner in db.ts. They are deliberately named outside the "runInTransaction"
// and "deriveQueueOpType" filter Task 1's verification uses.
describe("initLocalDb schema (Task 2)", () => {
  test("sets user_version to 1 and adds op_type, file_state and the queue indexes", async () => {
    const db = await getDb()

    const versionRow = await db.getFirstAsync<{ user_version: number }>(`PRAGMA user_version`)
    expect(versionRow?.user_version).toBe(1)

    const queueColumns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(sync_queue)`)
    expect(queueColumns.some((column) => column.name === "op_type")).toBe(true)

    const attachmentColumns = await db.getAllAsync<{ name: string }>(
      `PRAGMA table_info(local_attachments)`,
    )
    expect(attachmentColumns.some((column) => column.name === "file_state")).toBe(true)

    const indexes = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'index'`,
    )
    const indexNames = indexes.map((index) => index.name)
    expect(indexNames).toContain("idx_sync_queue_status_next_retry")
    expect(indexNames).toContain("idx_sync_queue_survey")
  })
})
