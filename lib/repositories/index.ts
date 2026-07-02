import "server-only";

// Single seam for storage choice. Route handlers and lib/auth/* import
// repositories from *this file only* — swapping SQLite for Supabase later is
// a matter of writing lib/repositories/supabase/* implementations of the
// interfaces in ./types and changing the three assignments below.
import { sqliteUserRepository } from "./sqlite/userRepository";
import { sqliteSessionRepository } from "./sqlite/sessionRepository";
import { sqliteSavedRecipeRepository } from "./sqlite/savedRecipeRepository";

export const userRepository = sqliteUserRepository;
export const sessionRepository = sqliteSessionRepository;
export const savedRecipeRepository = sqliteSavedRecipeRepository;

export type {
  UserRecord,
  UserRepository,
  SessionRecord,
  SessionRepository,
  SavedRecipeRecord,
  SavedRecipeRepository,
} from "./types";
