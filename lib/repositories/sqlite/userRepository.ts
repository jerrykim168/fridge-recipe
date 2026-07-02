import "server-only";
import { randomUUID } from "node:crypto";
import type { SqliteRow } from "node:sqlite";
import { getDb } from "@/lib/db/client";
import type { UserRecord, UserRepository } from "../types";

function mapRow(row: SqliteRow): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    createdAt: String(row.created_at),
  };
}

export const sqliteUserRepository: UserRepository = {
  async findByEmail(email) {
    const row = getDb()
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email);
    return row ? mapRow(row) : null;
  },

  async findById(id) {
    const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id);
    return row ? mapRow(row) : null;
  },

  async create({ email, passwordHash }) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    getDb()
      .prepare(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(id, email, passwordHash, createdAt);
    return { id, email, passwordHash, createdAt };
  },
};
