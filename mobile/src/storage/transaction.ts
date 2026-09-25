import * as SQLite from "expo-sqlite"
import { getDb } from "./db"

/**
 * The single owner of BEGIN/COMMIT for the local SQLite store (D-17).
 *
 * expo-sqlite's `withTransactionAsync` is not exclusive: other async queries on
 * the same connection can interleave with statements issued inside it (C14).
 * `runInTransaction` compensates with a module-level mutex, so at most one
 * transaction body runs its statements at a time.
 *
 * Reentrancy design (why not a plain "callback running" flag): React Native's
 * Hermes has no AsyncLocalStorage, so at call time this module cannot tell a
 * nested call made from inside a running callback apart from an unrelated
 * concurrent call made by another async flow. A global flag would make the
 * unrelated call throw, which would be wrong. Instead, the callback receives a
 * `TxHandle` (a distinct wrapper object, never the raw db). Code that already
 * holds a live handle joins the same transaction explicitly via
 * `runInTransaction(fn, tx)` (no BEGIN, no mutex wait). Any other write that
 * may run while inside a transaction should therefore accept a `DbExecutor`
 * parameter and be passed the handle by its caller.
 *
 * A forgotten handle can no longer hang the app silently: a mutex wait longer
 * than `TRANSACTION_WAIT_TIMEOUT_MS` rejects with
 * `Error("runInTransaction called reentrantly")` instead of blocking forever.
 * The message names the only realistic cause: no transaction body in this app
 * does network I/O, so a legitimate wait is far below the timeout.
 */

export type DbExecutor = Pick<
  SQLite.SQLiteDatabase,
  "runAsync" | "getFirstAsync" | "getAllAsync" | "execAsync"
>

export type TxHandle = DbExecutor & { readonly __tx: true }

export const TRANSACTION_WAIT_TIMEOUT_MS = 30_000

let unlockChain: Promise<void> = Promise.resolve()
let currentHandle: TxHandle | null = null

function acquireMutex(): Promise<() => void> {
  let releaseMine: () => void = () => {}
  const mine = new Promise<void>((resolve) => {
    releaseMine = resolve
  })
  const waitFor = unlockChain
  unlockChain = mine

  return new Promise<() => void>((resolve, reject) => {
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      // We never actually held the lock, so pass our slot through once the
      // real predecessor finishes, instead of wedging whoever is queued
      // behind us.
      void waitFor.then(() => releaseMine())
      reject(new Error("runInTransaction called reentrantly"))
    }, TRANSACTION_WAIT_TIMEOUT_MS)

    void waitFor.then(() => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(releaseMine)
    })
  })
}

function bindGuarded<K extends keyof DbExecutor>(
  db: DbExecutor,
  key: K,
  ensureAlive: () => void,
): DbExecutor[K] {
  const original = db[key] as unknown as (...args: unknown[]) => unknown
  return ((...args: unknown[]) => {
    ensureAlive()
    return original.apply(db, args)
  }) as DbExecutor[K]
}

/**
 * Runs `fn` inside a single serialised SQLite transaction and resolves with
 * its return value. On error, the transaction is rolled back and the same
 * error is rethrown.
 *
 * Pass `parentTx` (the live handle received by an enclosing `runInTransaction`
 * callback) to join that transaction instead of starting a new one. Calling
 * this without `parentTx` from inside a running callback waits on the mutex
 * like an unrelated caller, and times out per the header comment above.
 */
export async function runInTransaction<T>(
  fn: (tx: TxHandle) => Promise<T>,
  parentTx?: TxHandle,
): Promise<T> {
  if (parentTx) {
    if (parentTx !== currentHandle) {
      throw new Error("transaction handle used after the transaction ended")
    }
    return fn(parentTx)
  }

  const release = await acquireMutex()
  const db = await getDb()
  let dead = false
  const ensureAlive = (): void => {
    if (dead) {
      throw new Error("transaction handle used after the transaction ended")
    }
  }

  const handle = {
    __tx: true,
    runAsync: bindGuarded(db, "runAsync", ensureAlive),
    getFirstAsync: bindGuarded(db, "getFirstAsync", ensureAlive),
    getAllAsync: bindGuarded(db, "getAllAsync", ensureAlive),
    execAsync: bindGuarded(db, "execAsync", ensureAlive),
  } as TxHandle

  currentHandle = handle

  try {
    let result!: T
    await db.withTransactionAsync(async () => {
      result = await fn(handle)
    })
    return result
  } finally {
    dead = true
    currentHandle = null
    release()
  }
}
