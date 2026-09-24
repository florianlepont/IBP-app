import { DatabaseSync, SQLInputValue } from "node:sqlite"

/**
 * In-memory SQLite database exposing the subset of the expo-sqlite async API
 * the storage layer uses, backed by Node's built-in `node:sqlite` (Node 22+).
 * Lets storage tests run the real SQL instead of asserting on query strings.
 */
export function createNodeSqliteDb() {
  const db = new DatabaseSync(":memory:")
  const params = (values?: unknown[]): SQLInputValue[] => (values ?? []) as SQLInputValue[]

  return {
    execAsync: async (sql: string): Promise<void> => {
      db.exec(sql)
    },
    runAsync: async (
      sql: string,
      values?: unknown[],
    ): Promise<{ changes: number; lastInsertRowId: number }> => {
      const result = db.prepare(sql).run(...params(values))
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) }
    },
    getFirstAsync: async <T>(sql: string, values?: unknown[]): Promise<T | null> =>
      ((db.prepare(sql).get(...params(values)) as T | undefined) ?? null) as T | null,
    getAllAsync: async <T>(sql: string, values?: unknown[]): Promise<T[]> =>
      db.prepare(sql).all(...params(values)) as T[],
    withTransactionAsync: async (task: () => Promise<void>): Promise<void> => {
      db.exec("BEGIN")
      try {
        await task()
        db.exec("COMMIT")
      } catch (error) {
        db.exec("ROLLBACK")
        throw error
      }
    },
    closeAsync: async (): Promise<void> => {
      db.close()
    },
  }
}
