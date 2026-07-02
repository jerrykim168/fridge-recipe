// Storage-agnostic data access contracts for Step 3 (auth + saved recipes).
//
// Route handlers depend only on these interfaces (via lib/repositories'
// default export selection below... see index.ts), never on SQLite directly.
// To migrate to Supabase later: implement these same interfaces against the
// Supabase client and swap the exports in lib/repositories/index.ts — no
// route handler code should need to change.
//
// Methods are declared async even though the current SQLite implementation
// is synchronous under the hood, so call sites already match what a
// network-backed (Supabase) implementation will require.

import type { Recipe } from "@/lib/constants";

export type UserRecord = {
  id: string;
  email: string; // normalized: trimmed + lowercased
  passwordHash: string; // "salt:hash" hex, see lib/auth/password.ts
  createdAt: string; // ISO 8601
};

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: { email: string; passwordHash: string }): Promise<UserRecord>;
}

export type SessionRecord = {
  tokenHash: string;
  userId: string;
  expiresAt: number; // epoch ms
};

export interface SessionRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAtMs: number;
  }): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  /** Best-effort housekeeping; safe to call opportunistically. */
  deleteExpired(nowMs: number): Promise<void>;
}

export type SavedRecipeRecord = {
  id: string;
  userId: string;
  name: string;
  ingredients: string[];
  steps: string[];
  estimatedTime: string;
  difficulty?: string;
  servings?: string;
  savedAt: string; // ISO 8601
};

export interface SavedRecipeRepository {
  create(userId: string, recipe: Recipe): Promise<SavedRecipeRecord>;
  listByUser(userId: string): Promise<SavedRecipeRecord[]>;
  /** Deletes only if `id` belongs to `userId`. Returns whether a row was removed. */
  deleteForUser(id: string, userId: string): Promise<boolean>;
}
