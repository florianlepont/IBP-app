import { createNodeSqliteDb } from "./node-sqlite-db"

// Real SQL executes by default: every call to openDatabaseAsync returns a fresh
// in-memory node:sqlite database, so broken SQL fails the storage tests instead
// of a jest.fn() stub silently resolving. getDb() in mobile/src/storage/db.ts
// caches the resulting promise per module registry, so each test file gets one
// real database shared across its assertions. Tests needing a shared handle
// should call getDb() from the storage module rather than reaching in here.
export const openDatabaseAsync = jest.fn(async (_name: string) => createNodeSqliteDb())

export type SQLiteDatabase = ReturnType<typeof createNodeSqliteDb>
