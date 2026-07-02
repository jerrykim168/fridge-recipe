import "server-only";
import { randomUUID } from "node:crypto";
import type { SqliteRow } from "node:sqlite";
import { getDb } from "@/lib/db/client";
import type { SavedRecipeRecord, SavedRecipeRepository } from "../types";

function mapRow(row: SqliteRow): SavedRecipeRecord {
  const difficulty = row.difficulty == null ? undefined : String(row.difficulty);
  const servings = row.servings == null ? undefined : String(row.servings);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    ingredients: JSON.parse(String(row.ingredients)) as string[],
    steps: JSON.parse(String(row.steps)) as string[],
    estimatedTime: String(row.estimated_time),
    difficulty,
    servings,
    savedAt: String(row.saved_at),
  };
}

export const sqliteSavedRecipeRepository: SavedRecipeRepository = {
  async create(userId, recipe) {
    const id = randomUUID();
    const savedAt = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO saved_recipes
          (id, user_id, name, ingredients, steps, estimated_time, difficulty, servings, saved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        userId,
        recipe.name,
        JSON.stringify(recipe.ingredients),
        JSON.stringify(recipe.steps),
        recipe.estimatedTime,
        recipe.difficulty ?? null,
        recipe.servings ?? null,
        savedAt,
      );
    return {
      id,
      userId,
      name: recipe.name,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      estimatedTime: recipe.estimatedTime,
      difficulty: recipe.difficulty,
      servings: recipe.servings,
      savedAt,
    };
  },

  async listByUser(userId) {
    const rows = getDb()
      .prepare(
        "SELECT * FROM saved_recipes WHERE user_id = ? ORDER BY saved_at DESC",
      )
      .all(userId);
    return rows.map(mapRow);
  },

  async deleteForUser(id, userId) {
    const result = getDb()
      .prepare("DELETE FROM saved_recipes WHERE id = ? AND user_id = ?")
      .run(id, userId);
    return Number(result.changes) > 0;
  },
};
