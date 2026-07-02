import "server-only";
import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/db/supabase";
import type { Recipe } from "@/lib/constants";
import type { SavedRecipeRecord, SavedRecipeRepository } from "../types";

function mapRow(row: {
  id: string;
  user_id: string;
  name: string;
  ingredients: string[] | string;
  steps: string[] | string;
  estimated_time: string;
  difficulty: string | null;
  servings: string | null;
  saved_at: string;
}): SavedRecipeRecord {
  const ingredients =
    typeof row.ingredients === "string"
      ? JSON.parse(row.ingredients)
      : row.ingredients;
  const steps =
    typeof row.steps === "string" ? JSON.parse(row.steps) : row.steps;

  const difficulty = row.difficulty == null ? undefined : row.difficulty;
  const servings = row.servings == null ? undefined : row.servings;

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    ingredients,
    steps,
    estimatedTime: row.estimated_time,
    difficulty,
    servings,
    savedAt: row.saved_at,
  };
}

export const supabaseSavedRecipeRepository: SavedRecipeRepository = {
  async create(userId, recipe: Recipe) {
    const id = randomUUID();
    const savedAt = new Date().toISOString();

    const { data, error } = await supabase
      .from("saved_recipes")
      .insert([
        {
          id,
          user_id: userId,
          name: recipe.name,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          estimated_time: recipe.estimatedTime,
          difficulty: recipe.difficulty ?? null,
          servings: recipe.servings ?? null,
          saved_at: savedAt,
        },
      ])
      .select("*")
      .single();

    if (error) throw error;

    return mapRow(data);
  },

  async listByUser(userId) {
    const { data, error } = await supabase
      .from("saved_recipes")
      .select("*")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false });

    if (error) throw error;

    return (data || []).map(mapRow);
  },

  async deleteForUser(id, userId) {
    const { data, error } = await supabase
      .from("saved_recipes")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");

    if (error) throw error;

    return (data || []).length > 0;
  },
};
