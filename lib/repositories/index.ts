import "server-only";

// Single seam for storage choice. Route handlers and lib/auth/* import
// repositories from *this file only* — swapping SQLite for Supabase later is
// a matter of writing lib/repositories/supabase/* implementations of the
// interfaces in ./types and changing the three assignments below.
import { supabaseUserRepository } from "./supabase/userRepository";
import { supabaseSessionRepository } from "./supabase/sessionRepository";
import { supabaseSavedRecipeRepository } from "./supabase/savedRecipeRepository";

export const userRepository = supabaseUserRepository;
export const sessionRepository = supabaseSessionRepository;
export const savedRecipeRepository = supabaseSavedRecipeRepository;

export type {
  UserRecord,
  UserRepository,
  SessionRecord,
  SessionRepository,
  SavedRecipeRecord,
  SavedRecipeRepository,
} from "./types";
