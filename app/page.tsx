"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import styles from "./page.module.css";
import AuthBar from "@/components/AuthBar";
import SaveRecipeButton from "@/components/SaveRecipeButton";
import SavedRecipes from "@/components/SavedRecipes";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  MAX_INGREDIENTS,
  RECIPE_GENERATE_ENDPOINT,
  RECOGNIZE_ENDPOINT,
  type Recipe,
  type RecipeGenerateResponse,
  type RecognizeResponse,
} from "@/lib/constants";

type Status = "idle" | "preview" | "loading" | "success" | "error";
type RecipeStatus = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<string[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [newItem, setNewItem] = useState("");

  // Step 2 (recipe generation) — kept independent from the Step 1 status machine
  // so generating recipes never disturbs the upload/analysis flow above.
  const [recipeStatus, setRecipeStatus] = useState<RecipeStatus>("idle");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeError, setRecipeError] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const newItemId = useId();

  // Revoke object URLs to avoid memory leaks whenever the preview changes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const resetAll = useCallback(() => {
    setStatus("idle");
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIngredients([]);
    setConfirmed(null);
    setErrorMsg("");
    setNewItem("");
    setRecipeStatus("idle");
    setRecipes([]);
    setRecipeError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const acceptFile = useCallback((picked: File) => {
    // Client-side validation mirrors the server rules for fast feedback.
    if (!ACCEPTED_MIME_TYPES.includes(picked.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
      setStatus("error");
      setErrorMsg("지원하지 않는 형식입니다. JPG, PNG, WEBP 파일을 올려주세요.");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setStatus("error");
      setErrorMsg(`파일이 너무 큽니다. ${MAX_FILE_MB}MB 이하의 사진을 올려주세요.`);
      return;
    }
    setErrorMsg("");
    setConfirmed(null);
    setIngredients([]);
    setFile(picked);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(picked);
    });
    setStatus("preview");
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) acceptFile(picked);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const picked = e.dataTransfer.files?.[0];
    if (picked) acceptFile(picked);
  };

  const openFileDialog = () => fileInputRef.current?.click();

  const analyze = useCallback(async () => {
    if (!file) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch(RECOGNIZE_ENDPOINT, { method: "POST", body });

      let data: RecognizeResponse | null = null;
      try {
        data = (await res.json()) as RecognizeResponse;
      } catch {
        data = null;
      }

      if (!res.ok || !data || data.success !== true) {
        setStatus("error");
        setErrorMsg(
          (data && data.success === false && data.error) ||
            "재료 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }

      setIngredients(Array.isArray(data.ingredients) ? data.ingredients : []);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("요청을 보내지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
    }
  }, [file]);

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const addIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    const value = newItem.trim();
    if (!value) return;
    setIngredients((prev) =>
      prev.some((x) => x.toLowerCase() === value.toLowerCase())
        ? prev
        : [...prev, value],
    );
    setNewItem("");
  };

  // Confirming a (re)new ingredient list resets any previously generated
  // recipes so the results always reflect the currently confirmed input.
  const confirmIngredients = useCallback(() => {
    setConfirmed([...ingredients]);
    setRecipeStatus("idle");
    setRecipes([]);
    setRecipeError("");
  }, [ingredients]);

  const generateRecipes = useCallback(async () => {
    // FR-1.3: never send an empty list — the trigger is guarded, but re-check
    // here so the request can't fire without at least one ingredient.
    if (!confirmed || confirmed.length === 0) return;

    setRecipeStatus("loading");
    setRecipeError("");
    try {
      const res = await fetch(RECIPE_GENERATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: confirmed }),
      });

      let data: RecipeGenerateResponse | null = null;
      try {
        data = (await res.json()) as RecipeGenerateResponse;
      } catch {
        data = null;
      }

      // FR-4.2: guard against malformed / unexpected response shapes.
      if (
        !res.ok ||
        !data ||
        data.success !== true ||
        !Array.isArray(data.recipes) ||
        data.recipes.length === 0
      ) {
        setRecipeStatus("error");
        setRecipeError(
          (data && data.success === false && data.error) ||
            "레시피를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }

      setRecipes(data.recipes);
      setRecipeStatus("success");
    } catch {
      // FR-4.1: network failure / timeout.
      setRecipeStatus("error");
      setRecipeError(
        "요청을 보내지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
      );
    }
  }, [confirmed]);

  return (
    <main className={styles.page}>
      <AuthBar />

      <header className={styles.header}>
        <h1 className={styles.title}>냉장고를 부탁해</h1>
        <p className={styles.subtitle}>
          냉장고 사진을 올리면 AI가 식재료를 인식해 목록으로 만들어 드려요.
        </p>
      </header>

      {/* Screen-reader live region for status announcements. */}
      <div aria-live="polite" className="visually-hidden">
        {status === "loading" ? "재료를 분석하는 중입니다. 잠시만 기다려 주세요." : ""}
        {status === "success" ? `분석 완료. ${ingredients.length}개의 재료를 인식했습니다.` : ""}
        {recipeStatus === "loading" ? "레시피를 생성하는 중입니다. 잠시만 기다려 주세요." : ""}
        {recipeStatus === "success" ? `레시피 생성 완료. ${recipes.length}개의 레시피를 추천했습니다.` : ""}
      </div>

      {/* Hidden native input drives both click-to-select and drag-and-drop. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={onInputChange}
        className="visually-hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* STEP: Upload */}
      {(status === "idle" || (status === "error" && !file)) && (
        <section className={styles.card} aria-label="사진 업로드">
          <div
            className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
            role="button"
            tabIndex={0}
            aria-label="냉장고 사진 업로드. 클릭하거나 파일을 끌어다 놓으세요."
            onClick={openFileDialog}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openFileDialog();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
          >
            <span className={styles.dropzoneIcon} aria-hidden="true">
              📷
            </span>
            <strong>클릭하여 사진 선택</strong>
            <span className={styles.dropzoneHint}>
              또는 여기로 이미지를 끌어다 놓으세요
            </span>
            <span className={styles.dropzoneHint}>
              JPG · PNG · WEBP / 최대 {MAX_FILE_MB}MB
            </span>
          </div>
          {status === "error" && errorMsg && (
            <p className={styles.error} role="alert" style={{ marginTop: 16 }}>
              {errorMsg}
            </p>
          )}
        </section>
      )}

      {/* STEP: Preview + analyze (also covers loading & post-analysis errors) */}
      {file && status !== "idle" && (
        <section className={styles.card} aria-label="사진 미리보기 및 분석">
          <div className={styles.previewWrap}>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="업로드한 냉장고 사진 미리보기"
                className={styles.previewImage}
              />
            )}

            {status === "loading" && (
              <div className={styles.loading} role="status">
                <span className={styles.spinner} aria-hidden="true" />
                <span>AI가 재료를 분석하고 있어요…</span>
              </div>
            )}

            {status === "error" && (
              <div className={styles.error} role="alert">
                <span>{errorMsg}</span>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={analyze}
                  >
                    다시 시도
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={resetAll}
                  >
                    다른 사진 올리기
                  </button>
                </div>
              </div>
            )}

            {status === "preview" && (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={analyze}
                >
                  재료 분석하기
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={resetAll}
                >
                  사진 변경
                </button>
              </div>
            )}

            {status === "success" && (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={analyze}
                >
                  같은 사진 재분석
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={resetAll}
                >
                  새 사진 올리기
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* STEP: Results — editable ingredient list */}
      {status === "success" && (
        <section className={styles.card} aria-label="인식된 재료 목록">
          <h2 className={styles.sectionTitle}>인식된 재료</h2>

          {ingredients.length === 0 ? (
            <p className={styles.empty}>
              인식된 재료가 없습니다. 아래에서 직접 추가하거나 사진을 다시
              올려 재분석해 주세요.
            </p>
          ) : (
            <ul className={styles.chips}>
              {ingredients.map((item, i) => (
                <li key={`${item}-${i}`} className={styles.chip}>
                  <span>{item}</span>
                  <button
                    type="button"
                    className={styles.chipRemove}
                    onClick={() => removeIngredient(i)}
                    aria-label={`${item} 삭제`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className={styles.addRow} onSubmit={addIngredient}>
            <label htmlFor={newItemId} className="visually-hidden">
              재료 직접 추가
            </label>
            <input
              id={newItemId}
              className={styles.input}
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="재료 직접 추가 (예: 계란)"
              autoComplete="off"
            />
            <button
              type="submit"
              className={`${styles.btn} ${styles.btnSecondary}`}
              disabled={!newItem.trim()}
            >
              추가
            </button>
          </form>

          <hr className={styles.divider} />

          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={confirmIngredients}
            disabled={ingredients.length === 0}
          >
            재료 목록 확정하기
          </button>
        </section>
      )}

      {/* STEP: Confirmed final list */}
      {confirmed && (
        <section className={styles.card} aria-label="확정된 재료 목록">
          <h2 className={styles.sectionTitle}>확정된 재료 목록</h2>
          <div className={styles.confirmedBox}>
            {confirmed.length === 0 ? (
              <p className={styles.empty}>확정된 재료가 없습니다.</p>
            ) : (
              <ul className={styles.chips} style={{ marginBottom: 0 }}>
                {confirmed.map((item, i) => (
                  <li key={`confirmed-${item}-${i}`} className={styles.chip}>
                    <span style={{ paddingRight: 8 }}>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.confirmedNote}>
              이 재료들로 만들 수 있는 레시피를 아래에서 추천받아 보세요.
            </p>
          </div>
        </section>
      )}

      {/* STEP 2: Recipe generation */}
      {confirmed && (
        <section className={styles.card} aria-label="추천 레시피">
          <h2 className={styles.sectionTitle}>추천 레시피</h2>

          {recipeStatus === "idle" &&
            (confirmed.length === 0 ? (
              // FR-1.3: block generation when there is nothing to cook with.
              <p className={styles.empty}>
                확정된 재료가 없어요. 위에서 재료를 추가한 뒤 다시 확정해
                주세요.
              </p>
            ) : confirmed.length > MAX_INGREDIENTS ? (
              <p className={styles.empty}>
                재료가 너무 많아요. {MAX_INGREDIENTS}개 이하로 줄인 뒤 다시
                확정해 주세요.
              </p>
            ) : (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={generateRecipes}
              >
                레시피 추천받기
              </button>
            ))}

          {recipeStatus === "loading" && (
            <div className={styles.loading} role="status">
              <span className={styles.spinner} aria-hidden="true" />
              <span>AI가 레시피를 만들고 있어요…</span>
            </div>
          )}

          {recipeStatus === "error" && (
            <div className={styles.error} role="alert">
              <span>{recipeError}</span>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={generateRecipes}
                >
                  다시 시도
                </button>
              </div>
            </div>
          )}

          {recipeStatus === "success" && (
            <>
              <ul className={styles.recipeList}>
                {recipes.map((recipe, ri) => (
                  <li key={`${recipe.name}-${ri}`}>
                    <article className={styles.recipeCard}>
                      <h3 className={styles.recipeName}>{recipe.name}</h3>

                      <div className={styles.recipeMeta}>
                        {recipe.estimatedTime && (
                          <span className={styles.recipeBadge}>
                            ⏱ {recipe.estimatedTime}
                          </span>
                        )}
                        {recipe.difficulty && (
                          <span className={styles.recipeBadge}>
                            난이도 {recipe.difficulty}
                          </span>
                        )}
                        {recipe.servings && (
                          <span className={styles.recipeBadge}>
                            {recipe.servings}
                          </span>
                        )}
                      </div>

                      <h4 className={styles.recipeSubTitle}>재료</h4>
                      {recipe.ingredients.length === 0 ? (
                        <p className={styles.empty}>표시할 재료가 없습니다.</p>
                      ) : (
                        <ul className={styles.recipeIngredients}>
                          {recipe.ingredients.map((ing, ii) => (
                            <li
                              key={`${ing}-${ii}`}
                              className={styles.recipeIngredient}
                            >
                              {ing}
                            </li>
                          ))}
                        </ul>
                      )}

                      <h4 className={styles.recipeSubTitle}>조리 순서</h4>
                      {recipe.steps.length === 0 ? (
                        <p className={styles.empty}>조리 순서가 없습니다.</p>
                      ) : (
                        <ol className={styles.recipeSteps}>
                          {recipe.steps.map((step, si) => (
                            <li key={si}>{step}</li>
                          ))}
                        </ol>
                      )}

                      <SaveRecipeButton recipe={recipe} />
                    </article>
                  </li>
                ))}
              </ul>

              <hr className={styles.divider} />

              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={generateRecipes}
                >
                  다른 레시피 추천받기
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* STEP 3: Saved recipes (only shown to signed-in users) */}
      <SavedRecipes />
    </main>
  );
}
