import { NextRequest, NextResponse } from "next/server";
import {
  MAX_INGREDIENTS,
  type RecipeGenerateResponse,
} from "@/lib/constants";
import { OpenRouterError, generateRecipes } from "@/lib/openrouter";

// Contract (agreed with frontend, see lib/constants.ts):
//   POST /api/recipes/generate
//   Request:  application/json, { ingredients: string[] }   (min 1 item)
//   Success:  { success: true,  recipes: Recipe[] }          (200, >=1 recipe)
//   Error:    { success: false, error: string }              (4xx/5xx)

export const runtime = "nodejs";

// --- Minimal in-memory rate limiter (mirrors the recognize route) -----------
// Per-process only — fine for a single instance; swap for a shared store
// (Redis / Upstash) if this ever runs behind multiple server instances.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}

function json(body: RecipeGenerateResponse, status: number) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  if (isRateLimited(clientKey(req))) {
    return json(
      { success: false, error: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." },
      429,
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "잘못된 요청입니다. (JSON 형식 오류)" }, 400);
  }

  const rawIngredients = (body as { ingredients?: unknown })?.ingredients;
  if (!Array.isArray(rawIngredients)) {
    return json(
      { success: false, error: "재료 목록(ingredients 배열)이 필요합니다." },
      400,
    );
  }

  // Normalize: keep non-empty strings only, trim, de-duplicate.
  const seen = new Set<string>();
  const ingredients: string[] = [];
  for (const item of rawIngredients) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ingredients.push(trimmed);
  }

  if (ingredients.length === 0) {
    return json(
      { success: false, error: "재료를 최소 1개 이상 입력해 주세요." },
      400,
    );
  }

  if (ingredients.length > MAX_INGREDIENTS) {
    return json(
      {
        success: false,
        error: `재료는 최대 ${MAX_INGREDIENTS}개까지 입력할 수 있습니다.`,
      },
      400,
    );
  }

  try {
    const { recipes, model } = await generateRecipes(ingredients);
    // `model` logged for observability only — not part of the response contract.
    console.log(
      `[recipes/generate] model=${model} ingredients=${ingredients.length} recipes=${recipes.length}`,
    );
    return json({ success: true, recipes }, 200);
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return json(
        { success: false, error: err.message },
        err.status >= 400 && err.status < 600 ? err.status : 500,
      );
    }
    console.error("Unexpected error in /api/recipes/generate:", err);
    return json(
      { success: false, error: "예상치 못한 오류가 발생했습니다. 다시 시도해 주세요." },
      500,
    );
  }
}
