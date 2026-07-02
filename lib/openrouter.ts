// Server-only OpenRouter client. Must never be imported into a client
// component — it reads the API key from the environment and talks to
// OpenRouter directly. Used by the /api/ingredients/recognize (vision) and
// /api/recipes/generate (text) route handlers.
import "server-only";

import type { Recipe } from "@/lib/constants";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Vision-capable model used for ingredient recognition (Step 1).
//
// Why openai/gpt-4o-mini (default):
// - DeepSeek models (used elsewhere in this project for text/recipe
//   generation, per PRD_step2) do NOT support image input on OpenRouter —
//   they are text-only. A separate multimodal model is required here.
// - gpt-4o-mini supports image_url content parts, honors
//   `response_format: { type: "json_object" }` for reliable structured
//   output, has strong general-object/food recognition quality, and is one
//   of the cheaper vision-capable options on OpenRouter — a good fit for a
//   per-request, user-facing feature.
// - Kept configurable via env so it can be swapped without a code change
//   (e.g. google/gemini-flash-1.5 for lower latency/cost, or
//   qwen/qwen-2-vl-72b-instruct as an open-weight alternative).
const DEFAULT_VISION_MODEL = "openai/gpt-4o-mini";

const SYSTEM_PROMPT = `당신은 냉장고 내부 사진을 분석하는 식재료 인식 전문가입니다.
사진에서 실제로 보이는 '식재료'만 식별하세요. (예: 계란, 대파, 두부, 우유, 김치, 사과)
- 조미료 병, 브랜드, 포장 용기 자체가 아니라 '식재료 이름'으로 표현하세요.
- 확실히 식별 가능한 것만 포함하고, 추측성 항목은 넣지 마세요.
- 중복 없이 한국어 일반 명사로 표기하세요.
반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 절대 추가하지 마세요.
{"ingredients": ["재료1", "재료2"]}
식재료를 하나도 찾지 못하면 {"ingredients": []} 를 반환하세요.`;

const USER_PROMPT =
  "이 냉장고 사진에 보이는 식재료 목록을 JSON으로 추출해 주세요.";

export type VisionResult = {
  ingredients: string[];
  model: string;
};

/** Raised for any failure talking to OpenRouter. `retryable` and `status`
 * let the route handler decide the HTTP status and whether to invite the
 * client to retry. */
export class OpenRouterError extends Error {
  retryable: boolean;
  status: number;
  constructor(message: string, opts: { retryable: boolean; status: number }) {
    super(message);
    this.name = "OpenRouterError";
    this.retryable = opts.retryable;
    this.status = opts.status;
  }
}

/**
 * Sends a base64 image data URL to a vision-capable model on OpenRouter and
 * returns a de-duplicated list of ingredient names.
 */
export async function recognizeIngredients(
  imageDataUrl: string,
): Promise<VisionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // Configuration problem — not the user's fault, and not worth retrying.
    throw new OpenRouterError(
      "서버에 API 키가 설정되어 있지 않습니다. 관리자에게 문의하세요.",
      { retryable: false, status: 500 },
    );
  }

  const model = process.env.OPENROUTER_VISION_MODEL || DEFAULT_VISION_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_APP_URL || "http://localhost:3000",
        // HTTP header values must be ByteString (Latin-1) — the app title
        // contains Korean characters, so it must be percent-encoded or the
        // Headers constructor throws (Node/undici: "Cannot convert argument
        // to a ByteString"). OpenRouter accepts a percent-encoded X-Title.
        "X-Title": encodeURIComponent(
          process.env.OPENROUTER_APP_TITLE || "naengjango-butakhae",
        ),
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    // Network-level failure (DNS, TLS, connection reset, malformed request,
    // abort). Never includes the Authorization header, so safe to log as-is.
    console.error("OpenRouter fetch failed:", err);
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new OpenRouterError(
      aborted
        ? "분석 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
        : "AI 서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
      { retryable: true, status: 504 },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // 429 / 5xx are transient; 4xx (bad request/auth) are not.
    const retryable = res.status === 429 || res.status >= 500;
    // Do not surface the upstream response body — it may echo request
    // details or leak key-related hints. Log status only, never the key.
    console.error(`OpenRouter request failed with status ${res.status}`);
    throw new OpenRouterError(
      retryable
        ? "AI 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요."
        : "이미지 분석 요청이 거부되었습니다. 다른 사진으로 시도해 주세요.",
      { retryable, status: res.status === 429 ? 429 : 502 },
    );
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new OpenRouterError(
      "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.",
      { retryable: true, status: 502 },
    );
  }

  return { ingredients: parseIngredients(content), model };
}

/**
 * Robustly extracts an ingredient list from the model output. Handles clean
 * JSON, JSON wrapped in prose, and code fences — defends against the model
 * not perfectly following the requested response_format.
 */
export function parseIngredients(raw: string): string[] {
  const jsonSlice = extractJsonObject(raw);
  let list: unknown;

  if (jsonSlice) {
    try {
      list = (JSON.parse(jsonSlice) as { ingredients?: unknown }).ingredients;
    } catch {
      list = undefined;
    }
  }

  if (!Array.isArray(list)) return [];

  const cleaned = list
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);

  // De-duplicate case-insensitively while preserving first-seen order.
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of cleaned) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

// --- Step 2: Recipe generation (text LLM) ------------------------------------
//
// Why deepseek/deepseek-chat (default):
// - Text-only task (재료 목록 → 레시피), so no vision model needed. This project
//   always intended DeepSeek via OpenRouter for text generation (PRD_step2).
// - Live-tested on OpenRouter: strong Korean cooking output, very low cost
//   (~$0.0004 / 2-recipe call), and it produces valid JSON — BUT the serving
//   provider (StreamLake / deepseek-chat-v3) does NOT reliably honor
//   `response_format: { type: "json_object" }`; it often wraps the payload in
//   ```json code fences. So we rely on defensive parsing (extractJsonObject
//   below, first-`{`..last-`}`) rather than trusting the response_format flag.
// - Swappable via OPENROUTER_RECIPE_MODEL without a code change.
const DEFAULT_RECIPE_MODEL = "deepseek/deepseek-chat";

// How many recipe candidates to ask for (FR-3.1 requires >= 1). Three gives
// the user a useful choice without ballooning latency/token cost.
const RECIPE_COUNT = 3;

const RECIPE_SYSTEM_PROMPT = `당신은 주어진 재료로 만들 수 있는 한국 가정식 요리를 추천하는 요리 레시피 생성 전문가입니다.
규칙:
- 사용자가 제공한 재료를 최대한 활용하는 현실적인 레시피만 제안하세요.
- 소금, 후추, 식용유, 물 같은 기본 조미료는 목록에 없어도 사용할 수 있습니다.
- 각 레시피의 재료 목록에는 실제로 사용하는 재료를 모두 적으세요.
- 조리 순서(steps)는 초보자도 따라 할 수 있게 단계별 문장으로 작성하세요.
- 재료와 무관하거나 비현실적인 요리는 만들지 마세요.
반드시 아래 JSON 형식으로만 응답하세요. 코드펜스나 다른 설명은 절대 추가하지 마세요.
{"recipes":[{"name":"요리명","ingredients":["재료1","재료2"],"steps":["1단계 설명","2단계 설명"],"estimatedTime":"약 20분","difficulty":"쉬움","servings":"2인분"}]}`;

/**
 * Generates recipe candidates from an ingredient list using a text LLM on
 * OpenRouter. Reuses OPENROUTER_API_KEY (same key as Step 1). Never logs the
 * key. Throws OpenRouterError on any failure so the route can map it to HTTP.
 */
export async function generateRecipes(
  ingredients: string[],
): Promise<{ recipes: Recipe[]; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError(
      "서버에 API 키가 설정되어 있지 않습니다. 관리자에게 문의하세요.",
      { retryable: false, status: 500 },
    );
  }

  const model = process.env.OPENROUTER_RECIPE_MODEL || DEFAULT_RECIPE_MODEL;

  const userPrompt = `다음 재료로 만들 수 있는 요리 레시피 ${RECIPE_COUNT}개를 서로 다르게 제안해 주세요.
재료 목록: ${ingredients.join(", ")}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_APP_URL || "http://localhost:3000",
        "X-Title": encodeURIComponent(
          process.env.OPENROUTER_APP_TITLE || "naengjango-butakhae",
        ),
      },
      body: JSON.stringify({
        model,
        // Some creative variety across the 3 candidates, but not so high that
        // the model drifts into unrealistic dishes (NFR-2).
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: RECIPE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    console.error("OpenRouter fetch failed:", err);
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new OpenRouterError(
      aborted
        ? "레시피 생성 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
        : "AI 서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.",
      { retryable: true, status: 504 },
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    console.error(`OpenRouter recipe request failed with status ${res.status}`);
    throw new OpenRouterError(
      retryable
        ? "AI 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요."
        : "레시피 생성 요청이 거부되었습니다. 다른 재료로 시도해 주세요.",
      { retryable, status: res.status === 429 ? 429 : 502 },
    );
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new OpenRouterError(
      "AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.",
      { retryable: true, status: 502 },
    );
  }

  const recipes = parseRecipes(content);
  if (recipes.length === 0) {
    // Model replied but nothing usable could be parsed (FR-4.2). Treat as a
    // transient/format failure the user can retry.
    throw new OpenRouterError(
      "레시피 형식을 해석하지 못했습니다. 다시 시도해 주세요.",
      { retryable: true, status: 502 },
    );
  }

  return { recipes, model };
}

/**
 * Robustly extracts a recipe list from model output. Handles clean JSON, JSON
 * wrapped in prose, and ```json code fences (DeepSeek/StreamLake commonly adds
 * these despite response_format). Every field is validated and coerced so a
 * partially-malformed recipe never crashes the route (NFR-3); recipes missing
 * required fields (name/steps) are dropped rather than surfaced half-formed.
 */
export function parseRecipes(raw: string): Recipe[] {
  const jsonSlice = extractJsonObject(raw);
  if (!jsonSlice) return [];

  let parsed: { recipes?: unknown };
  try {
    parsed = JSON.parse(jsonSlice) as { recipes?: unknown };
  } catch {
    return [];
  }

  const list = parsed?.recipes;
  if (!Array.isArray(list)) return [];

  const result: Recipe[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;

    const name = typeof r.name === "string" ? r.name.trim() : "";
    const ingredients = toStringArray(r.ingredients);
    const steps = toStringArray(r.steps).map(stripLeadingStepNumber);
    const estimatedTime =
      typeof r.estimatedTime === "string" && r.estimatedTime.trim()
        ? r.estimatedTime.trim()
        : "시간 정보 없음";

    // A recipe without a name or any steps is not usable — skip it.
    if (!name || steps.length === 0) continue;

    const recipe: Recipe = { name, ingredients, steps, estimatedTime };

    if (typeof r.difficulty === "string" && r.difficulty.trim()) {
      recipe.difficulty = r.difficulty.trim();
    }
    if (typeof r.servings === "string" && r.servings.trim()) {
      recipe.servings = r.servings.trim();
    }

    result.push(recipe);
  }

  return result;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

// The model sometimes prefixes steps with "1. " even though we render them
// in an <ol>, which doubles up the numbering ("1. 1. ...") in the UI.
function stripLeadingStepNumber(step: string): string {
  return step.replace(/^\s*\d+\s*[.)\-:、]\s*/, "");
}
