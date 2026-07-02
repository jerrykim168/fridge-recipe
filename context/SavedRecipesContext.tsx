"use client";

// Holds the current user's saved-recipe list so the save buttons (which need to
// know "already saved?" — FR-1.2) and the saved-list section stay in sync
// without refetching. The list is fetched when a user logs in and cleared on
// logout, enforcing "own data only" at the UI layer (FR-3.2).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  RECIPES_SAVE_ENDPOINT,
  type DeleteRecipeResponse,
  type ListSavedResponse,
  type Recipe,
  type SavedRecipe,
  type SaveRecipeResponse,
} from "@/lib/constants";

type ListStatus = "idle" | "loading" | "success" | "error";
type Result = { ok: boolean; error?: string };

type SavedRecipesContextValue = {
  saved: SavedRecipe[];
  status: ListStatus;
  error: string;
  refresh: () => Promise<void>;
  saveRecipe: (recipe: Recipe) => Promise<Result>;
  deleteRecipe: (id: string) => Promise<Result>;
  /** Whether a recipe with this name is already saved (FR-1.2). */
  isSaved: (recipe: Recipe) => boolean;
};

const SavedRecipesContext = createContext<SavedRecipesContextValue | null>(null);

const NETWORK_ERROR =
  "요청을 보내지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.";

// Recipes generated in Step 2 have no id, so duplicate detection is by name.
const normalizeName = (name: string) => name.trim().toLowerCase();

export function SavedRecipesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [status, setStatus] = useState<ListStatus>("idle");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(RECIPES_SAVE_ENDPOINT, {
        credentials: "include",
      });
      let data: ListSavedResponse | null = null;
      try {
        data = (await res.json()) as ListSavedResponse;
      } catch {
        data = null;
      }
      if (!res.ok || !data || data.success !== true) {
        setStatus("error");
        setError(
          (data && data.success === false && data.error) ||
            "저장한 레시피를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }
      // Newest first (FR-4.3, optional but cheap and helpful).
      const list = [...data.recipes].sort((a, b) =>
        (b.savedAt ?? "").localeCompare(a.savedAt ?? ""),
      );
      setSaved(list);
      setStatus("success");
    } catch {
      setStatus("error");
      setError(NETWORK_ERROR);
    }
  }, []);

  // Fetch on login; clear on logout so no stale/foreign data lingers.
  useEffect(() => {
    if (user) {
      void refresh();
    } else {
      setSaved([]);
      setStatus("idle");
      setError("");
    }
  }, [user, refresh]);

  const saveRecipe = useCallback(
    async (recipe: Recipe): Promise<Result> => {
      try {
        const res = await fetch(RECIPES_SAVE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ recipe }),
        });
        let data: SaveRecipeResponse | null = null;
        try {
          data = (await res.json()) as SaveRecipeResponse;
        } catch {
          data = null;
        }
        if (!res.ok || !data || data.success !== true) {
          return {
            ok: false,
            error:
              (data && data.success === false && data.error) ||
              "레시피를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
          };
        }
        const savedRecipe = data.recipe;
        setSaved((prev) =>
          prev.some((r) => r.id === savedRecipe.id)
            ? prev
            : [savedRecipe, ...prev],
        );
        return { ok: true };
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    [],
  );

  const deleteRecipe = useCallback(async (id: string): Promise<Result> => {
    try {
      const res = await fetch(
        `${RECIPES_SAVE_ENDPOINT}?id=${encodeURIComponent(id)}`,
        { method: "DELETE", credentials: "include" },
      );
      let data: DeleteRecipeResponse | null = null;
      try {
        data = (await res.json()) as DeleteRecipeResponse;
      } catch {
        data = null;
      }
      if (!res.ok || !data || data.success !== true) {
        return {
          ok: false,
          error:
            (data && data.success === false && data.error) ||
            "레시피를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        };
      }
      setSaved((prev) => prev.filter((r) => r.id !== id));
      return { ok: true };
    } catch {
      return { ok: false, error: NETWORK_ERROR };
    }
  }, []);

  const isSaved = useCallback(
    (recipe: Recipe) => {
      const target = normalizeName(recipe.name);
      return saved.some((r) => normalizeName(r.name) === target);
    },
    [saved],
  );

  const value = useMemo<SavedRecipesContextValue>(
    () => ({
      saved,
      status,
      error,
      refresh,
      saveRecipe,
      deleteRecipe,
      isSaved,
    }),
    [saved, status, error, refresh, saveRecipe, deleteRecipe, isSaved],
  );

  return (
    <SavedRecipesContext.Provider value={value}>
      {children}
    </SavedRecipesContext.Provider>
  );
}

export function useSavedRecipes(): SavedRecipesContextValue {
  const ctx = useContext(SavedRecipesContext);
  if (!ctx) {
    throw new Error(
      "useSavedRecipes must be used within a SavedRecipesProvider",
    );
  }
  return ctx;
}
