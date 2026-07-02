// Shared constraints used by both client and server so validation messages stay
// consistent. Keep in sync with the UI copy.

export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_FILE_MB = 8;

export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";

// API contract with the backend (owned by backend-architect):
//   POST /api/ingredients/recognize
//   Request:  multipart/form-data, field `image`
//   Success:  { success: true,  ingredients: string[] }
//   Error:    { success: false, error: string }  (HTTP 4xx/5xx)
export const RECOGNIZE_ENDPOINT = "/api/ingredients/recognize";

export type RecognizeSuccess = {
  success: true;
  ingredients: string[];
};

export type RecognizeError = {
  success: false;
  error: string;
};

export type RecognizeResponse = RecognizeSuccess | RecognizeError;

// --- Step 2: Recipe generation ------------------------------------------------
// API contract with the backend (owned by llm-integration-expert / backend):
//   POST /api/recipes/generate
//   Request:  application/json, { ingredients: string[] }   (min 1 item)
//   Success:  { success: true,  recipes: Recipe[] }          (200, >=1 recipe)
//   Error:    { success: false, error: string }              (HTTP 4xx/5xx)
// Shared with frontend-developer — do not rename without coordinating.
export const RECIPE_GENERATE_ENDPOINT = "/api/recipes/generate";

// Upper bound on how many ingredient strings a single request may contain.
// Guards against oversized prompts / abuse. Keep in sync with the UI.
export const MAX_INGREDIENTS = 30;

export type Recipe = {
  name: string;
  ingredients: string[];
  steps: string[];
  estimatedTime: string;
  // Optional enrichment (FR-2.5) — present when the model supplies them.
  difficulty?: string;
  servings?: string;
};

export type RecipeGenerateRequest = {
  ingredients: string[];
};

export type RecipeGenerateSuccess = {
  success: true;
  recipes: Recipe[];
};

export type RecipeGenerateError = {
  success: false;
  error: string;
};

export type RecipeGenerateResponse =
  | RecipeGenerateSuccess
  | RecipeGenerateError;

// --- Step 3: Auth + recipe saving --------------------------------------------
// API contract with the backend (owned by backend-architect).
// Auth is email + password self-managed accounts (no social login).
// Sessions are carried by an httpOnly cookie, so every fetch below must send
// `credentials: "include"`. Shared with frontend-developer — do not rename
// fields/endpoints without coordinating.
//
//   POST /api/auth/signup   Request: SignupRequest  -> AuthResponse
//   POST /api/auth/login    Request: LoginRequest   -> AuthResponse
//   POST /api/auth/logout   Request: (none)         -> { success: boolean }
//   GET  /api/auth/me       -> MeResponse (user is null when not logged in)
//   POST   /api/recipes/save  Request: SaveRecipeRequest -> SaveRecipeResponse
//   GET    /api/recipes/save  -> ListSavedResponse (current user only)
//   DELETE /api/recipes/save?id=<id> -> DeleteRecipeResponse
export const AUTH_SIGNUP_ENDPOINT = "/api/auth/signup";
export const AUTH_LOGIN_ENDPOINT = "/api/auth/login";
export const AUTH_LOGOUT_ENDPOINT = "/api/auth/logout";
export const AUTH_ME_ENDPOINT = "/api/auth/me";
export const RECIPES_SAVE_ENDPOINT = "/api/recipes/save";

// Minimum password length — enforced client-side for fast feedback and by the
// server as the source of truth. Keep in sync with the UI copy.
export const MIN_PASSWORD_LENGTH = 8;

export type AuthUser = {
  id: string;
  email: string;
  // ISO 8601 timestamp of account creation (optional — present when supplied).
  createdAt?: string;
};

export type SignupRequest = {
  email: string;
  password: string;
  passwordConfirm: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type AuthSuccess = {
  success: true;
  user: AuthUser;
};

export type AuthError = {
  success: false;
  error: string;
};

export type AuthResponse = AuthSuccess | AuthError;

// GET /api/auth/me — `user` is null when the request carries no valid session.
export type MeSuccess = {
  success: true;
  user: AuthUser | null;
};

export type MeResponse = MeSuccess | AuthError;

// A saved recipe is a Step 2 recipe plus persistence metadata. The recipe body
// (name/ingredients/steps/estimatedTime) is stored verbatim so it can be shown
// exactly as it was saved (NFR-4).
export type SavedRecipe = Recipe & {
  id: string;
  // ISO 8601 timestamp of when the recipe was saved (FR-2.5).
  savedAt: string;
};

export type SaveRecipeRequest = {
  recipe: Recipe;
};

export type SaveRecipeSuccess = {
  success: true;
  recipe: SavedRecipe;
};

export type SaveRecipeResponse = SaveRecipeSuccess | AuthError;

export type ListSavedSuccess = {
  success: true;
  recipes: SavedRecipe[];
};

export type ListSavedResponse = ListSavedSuccess | AuthError;

export type DeleteRecipeResponse =
  | { success: true }
  | { success: false; error: string };
