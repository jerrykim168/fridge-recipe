"use client";

// "저장한 레시피" section: list (name + saved date), expandable detail
// (ingredients / steps / time), and delete with an inline confirm step.
// Only rendered for signed-in users; enforces "own data only" (FR-3.2).

import { useId, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSavedRecipes } from "@/context/SavedRecipesContext";
import type { SavedRecipe } from "@/lib/constants";
import page from "@/app/page.module.css";
import s from "./step3.module.css";

function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function SavedRecipeItem({ recipe }: { recipe: SavedRecipe }) {
  const { deleteRecipe } = useSavedRecipes();
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const detailId = useId();

  const onDelete = async () => {
    setDeleting(true);
    setError("");
    const result = await deleteRecipe(recipe.id);
    // On success the item unmounts (removed from context list), so no further
    // state updates are needed. On failure, surface the error and stay.
    if (!result.ok) {
      setDeleting(false);
      setConfirming(false);
      setError(result.error || "레시피를 삭제하지 못했습니다.");
    }
  };

  const savedAt = formatSavedAt(recipe.savedAt);

  return (
    <li className={s.savedItem}>
      <div className={s.savedItemHeader}>
        <button
          type="button"
          className={s.savedTitleBtn}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={detailId}
        >
          <span className={s.savedName}>{recipe.name}</span>
          {savedAt && <span className={s.savedDate}>{savedAt} 저장</span>}
          <span className={s.savedChevron} aria-hidden="true">
            {expanded ? "▲" : "▼"}
          </span>
        </button>

        {!confirming ? (
          <button
            type="button"
            className={`${page.btn} ${page.btnSecondary} ${s.deleteBtn}`}
            onClick={() => {
              setConfirming(true);
              setError("");
            }}
            aria-label={`${recipe.name} 삭제`}
          >
            삭제
          </button>
        ) : (
          <span className={s.confirmRow} role="group" aria-label="삭제 확인">
            <span className={s.confirmText}>삭제할까요?</span>
            <button
              type="button"
              className={`${page.btn} ${s.dangerBtn} ${s.confirmBtn}`}
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? "삭제 중…" : "삭제"}
            </button>
            <button
              type="button"
              className={`${page.btn} ${page.btnSecondary} ${s.confirmBtn}`}
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              취소
            </button>
          </span>
        )}
      </div>

      {error && (
        <p className={page.error} role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}

      {expanded && (
        <div id={detailId} className={s.savedDetail}>
          <div className={page.recipeMeta}>
            {recipe.estimatedTime && (
              <span className={page.recipeBadge}>⏱ {recipe.estimatedTime}</span>
            )}
            {recipe.difficulty && (
              <span className={page.recipeBadge}>난이도 {recipe.difficulty}</span>
            )}
            {recipe.servings && (
              <span className={page.recipeBadge}>{recipe.servings}</span>
            )}
          </div>

          <h4 className={page.recipeSubTitle}>재료</h4>
          {recipe.ingredients.length === 0 ? (
            <p className={page.empty}>표시할 재료가 없습니다.</p>
          ) : (
            <ul className={page.recipeIngredients}>
              {recipe.ingredients.map((ing, i) => (
                <li key={`${ing}-${i}`} className={page.recipeIngredient}>
                  {ing}
                </li>
              ))}
            </ul>
          )}

          <h4 className={page.recipeSubTitle}>조리 순서</h4>
          {recipe.steps.length === 0 ? (
            <p className={page.empty}>조리 순서가 없습니다.</p>
          ) : (
            <ol className={page.recipeSteps}>
              {recipe.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

export default function SavedRecipes() {
  const { user } = useAuth();
  const { saved, status, error, refresh } = useSavedRecipes();

  // Only signed-in users have a saved list (FR-0.2 / FR-3.2).
  if (!user) return null;

  return (
    <section className={page.card} aria-label="저장한 레시피">
      <h2 className={page.sectionTitle}>저장한 레시피</h2>

      <div aria-live="polite" className="visually-hidden">
        {status === "loading" ? "저장한 레시피를 불러오는 중입니다." : ""}
        {status === "success"
          ? `저장한 레시피 ${saved.length}개를 불러왔습니다.`
          : ""}
      </div>

      {status === "loading" && (
        <div className={page.loading} role="status">
          <span className={page.spinner} aria-hidden="true" />
          <span>저장한 레시피를 불러오고 있어요…</span>
        </div>
      )}

      {status === "error" && (
        <div className={page.error} role="alert">
          <span>{error}</span>
          <div className={page.actions}>
            <button
              type="button"
              className={`${page.btn} ${page.btnPrimary}`}
              onClick={() => void refresh()}
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {status === "success" &&
        (saved.length === 0 ? (
          // FR-3.5: empty state.
          <p className={page.empty}>
            아직 저장한 레시피가 없어요. 위의 추천 레시피에서 마음에 드는
            레시피를 저장해 보세요.
          </p>
        ) : (
          <ul className={s.savedList}>
            {saved.map((recipe) => (
              <SavedRecipeItem key={recipe.id} recipe={recipe} />
            ))}
          </ul>
        ))}
    </section>
  );
}
