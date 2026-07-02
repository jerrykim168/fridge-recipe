"use client";

// Per-recipe "저장" button rendered inside each Step 2 recipe card.
// - Logged out: clicking routes the user to login/signup (FR-0.3).
// - Already saved: shows a disabled "저장됨" state (FR-1.2).

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSavedRecipes } from "@/context/SavedRecipesContext";
import type { Recipe } from "@/lib/constants";
import page from "@/app/page.module.css";
import s from "./step3.module.css";

type SaveStatus = "idle" | "saving" | "error";

export default function SaveRecipeButton({ recipe }: { recipe: Recipe }) {
  const { user, openAuthDialog } = useAuth();
  const { isSaved, saveRecipe } = useSavedRecipes();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const saved = isSaved(recipe);

  const onClick = async () => {
    if (!user) {
      // FR-0.3: guide anonymous users to authenticate instead of saving.
      openAuthDialog("login");
      return;
    }
    if (saved || status === "saving") return;

    setStatus("saving");
    setError("");
    const result = await saveRecipe(recipe);
    if (!result.ok) {
      setStatus("error");
      setError(result.error || "레시피를 저장하지 못했습니다.");
      return;
    }
    setStatus("idle");
    setJustSaved(true);
  };

  return (
    <div className={s.saveWrap}>
      {/* Announce successful save without moving focus. */}
      <span aria-live="polite" className="visually-hidden">
        {justSaved ? `${recipe.name} 레시피를 저장했습니다.` : ""}
      </span>

      {saved ? (
        <span className={s.savedBadge} role="status">
          <span aria-hidden="true">✓</span> 저장됨
        </span>
      ) : (
        <button
          type="button"
          className={`${page.btn} ${page.btnSecondary} ${s.saveBtn}`}
          onClick={onClick}
          disabled={status === "saving"}
          aria-label={
            user
              ? `${recipe.name} 레시피 저장`
              : `${recipe.name} 레시피 저장 (로그인 필요)`
          }
        >
          {status === "saving" ? (
            <span className={s.btnLoading}>
              <span className={page.spinner} aria-hidden="true" />
              저장 중…
            </span>
          ) : (
            <>
              <span aria-hidden="true">♡</span> 저장
            </>
          )}
        </button>
      )}

      {status === "error" && error && (
        <p className={page.error} role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}
