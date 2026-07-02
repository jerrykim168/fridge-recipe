import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// SQLite storage for Step 3 (auth + saved recipes). Node's built-in
// `node:sqlite` is used deliberately instead of `better-sqlite3` — it ships
// with Node 22.5+/24.x, needs no native build step, and this project runs on
// Windows dev machines without guaranteed native build tooling.
//
// This module is the *only* place that knows a SQLite file exists. Everything
// above it (lib/repositories/*) talks to a storage-agnostic interface so a
// future Supabase migration only means writing new repository
// implementations and swapping the exports in lib/repositories/index.ts.

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "app.db");

declare global {
  // Reused across Next.js dev hot-reloads so we don't reopen/relock the file
  // (and re-run CREATE TABLE) on every module re-evaluation.
  // eslint-disable-next-line no-var
  var __fridgeDb: DatabaseSync | undefined;
}

function migrate(db: DatabaseSync): void {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // token_hash (SHA-256 of the raw cookie token) is the primary key so a
  // stolen DB row alone can't be replayed as a session cookie.
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);`);

  // Recipe body is stored verbatim (ingredients/steps as JSON arrays) so a
  // saved recipe round-trips exactly as generated (NFR-4).
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_recipes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      ingredients TEXT NOT NULL,
      steps TEXT NOT NULL,
      estimated_time TEXT NOT NULL,
      difficulty TEXT,
      servings TEXT,
      saved_at TEXT NOT NULL
    );
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_id ON saved_recipes(user_id);`,
  );
}

function createDb(): DatabaseSync {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  migrate(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__fridgeDb) {
    globalThis.__fridgeDb = createDb();
  }
  return globalThis.__fridgeDb;
}
