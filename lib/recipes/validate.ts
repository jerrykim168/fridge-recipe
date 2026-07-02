import type { Recipe } from "@/lib/constants";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** Structural check for the client-supplied `recipe` body of SaveRecipeRequest. */
export function isValidRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;

  if (typeof r.name !== "string" || r.name.trim().length === 0) return false;
  if (!isStringArray(r.ingredients)) return false;
  if (!isStringArray(r.steps)) return false;
  if (typeof r.estimatedTime !== "string" || r.estimatedTime.trim().length === 0)
    return false;
  if (r.difficulty !== undefined && typeof r.difficulty !== "string") return false;
  if (r.servings !== undefined && typeof r.servings !== "string") return false;

  return true;
}
