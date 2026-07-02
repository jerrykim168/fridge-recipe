import "server-only";
import type { SqliteRow } from "node:sqlite";
import { getDb } from "@/lib/db/client";
import type { SessionRecord, SessionRepository } from "../types";

function mapRow(row: SqliteRow): SessionRecord {
  return {
    tokenHash: String(row.token_hash),
    userId: String(row.user_id),
    expiresAt: Number(row.expires_at),
  };
}

export const sqliteSessionRepository: SessionRepository = {
  async create({ userId, tokenHash, expiresAtMs }) {
    getDb()
      .prepare(
        "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(tokenHash, userId, expiresAtMs, Date.now());
  },

  async findByTokenHash(tokenHash) {
    const row = getDb()
      .prepare("SELECT * FROM sessions WHERE token_hash = ?")
      .get(tokenHash);
    return row ? mapRow(row) : null;
  },

  async deleteByTokenHash(tokenHash) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  },

  async deleteExpired(nowMs) {
    getDb().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowMs);
  },
};
