import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"
import type { InterviewState } from "./types"

export interface StoredSession {
  id: string
  state: InterviewState
  updatedAt: string
  mailStatus?: "not_sent"
}

export interface InterviewStore {
  kind: "postgres" | "sqlite" | "file" | "memory"
  get(id: string): Promise<StoredSession | null>
  save(row: StoredSession): Promise<void>
}

interface SqliteStatement {
  run(...args: unknown[]): unknown
  get(...args: unknown[]): unknown
  all(...args: unknown[]): unknown[]
}

interface SqliteDatabase {
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
}

const DDL = `CREATE TABLE IF NOT EXISTS onb1_interviews (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`

export function memoryStore(): InterviewStore {
  const rows = new Map<string, StoredSession>()
  return {
    kind: "memory",
    async get(id) {
      return rows.get(id) ?? null
    },
    async save(row) {
      rows.set(row.id, row)
    },
  }
}

function fileStore(filePath: string): InterviewStore {
  mkdirSync(dirname(filePath), { recursive: true })
  const readAll = (): Record<string, StoredSession> => {
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, StoredSession>
    } catch {
      return {}
    }
  }
  return {
    kind: "file",
    async get(id) {
      return readAll()[id] ?? null
    },
    async save(row) {
      const all = readAll()
      all[row.id] = row
      writeFileSync(filePath, JSON.stringify(all))
    },
  }
}

async function sqliteStore(filePath: string): Promise<InterviewStore | null> {
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{
      DatabaseSync: new (path: string) => SqliteDatabase
    }>
    const mod = await dynamicImport("node:sqlite")
    const db = new mod.DatabaseSync(filePath)
    db.exec(DDL)
    return {
      kind: "sqlite",
      async get(id) {
        const row = db.prepare("SELECT payload FROM onb1_interviews WHERE id = ?").get(id) as { payload?: string } | undefined
        return row?.payload ? (JSON.parse(row.payload) as StoredSession) : null
      },
      async save(row) {
        db.prepare(
          "INSERT INTO onb1_interviews (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
        ).run(row.id, JSON.stringify(row), row.updatedAt)
      },
    }
  } catch {
    return null
  }
}

async function postgresStore(databaseUrl: string): Promise<InterviewStore | null> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{
      Pool: new (config: { connectionString: string }) => {
        query(text: string, values?: unknown[]): Promise<{ rows: { payload?: unknown }[] }>
      }
    }>
    const { Pool } = await dynamicImport("pg")
    const pool = new Pool({ connectionString: databaseUrl })
    await pool.query(`CREATE TABLE IF NOT EXISTS onb1_interviews (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )`)
    return {
      kind: "postgres",
      async get(id) {
        const result = await pool.query("SELECT payload FROM onb1_interviews WHERE id = $1", [id])
        const payload = result.rows[0]?.payload
        if (!payload) return null
        return (typeof payload === "string" ? JSON.parse(payload) : payload) as StoredSession
      },
      async save(row) {
        await pool.query(
          `INSERT INTO onb1_interviews (id, payload, updated_at) VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
          [row.id, JSON.stringify(row), row.updatedAt],
        )
      },
    }
  } catch {
    return null
  }
}

let singleton: Promise<InterviewStore> | null = null

export function storeFilePath(): string {
  return process.env.ONB1_STORE_PATH || join(tmpdir(), "onb1-interviews.json")
}

export function getStore(): Promise<InterviewStore> {
  if (!singleton) {
    singleton = (async () => {
      if (process.env.DATABASE_URL) {
        const postgres = await postgresStore(process.env.DATABASE_URL)
        if (postgres) return postgres
      }
      const sqlitePath = process.env.ONB1_SQLITE_PATH || join(tmpdir(), "onb1-interviews.sqlite")
      const sqlite = await sqliteStore(sqlitePath)
      if (sqlite) return sqlite
      return fileStore(storeFilePath())
    })()
  }
  return singleton
}

export function resetStoreForTests(): void {
  singleton = null
}
