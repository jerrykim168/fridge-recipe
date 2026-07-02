import { NextRequest, NextResponse } from "next/server";
import {
  ACCEPTED_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
  type RecognizeResponse,
} from "@/lib/constants";
import { OpenRouterError, recognizeIngredients } from "@/lib/openrouter";
import { clientKey, createRateLimiter } from "@/lib/security/rateLimit";

// Contract (agreed with frontend, see lib/constants.ts):
//   POST /api/ingredients/recognize
//   Request:  multipart/form-data, field `image`
//   Success:  { success: true,  ingredients: string[] }   (200)
//   Error:    { success: false, error: string }           (4xx/5xx)

export const runtime = "nodejs";

// PRD FR-3.5: abuse prevention — rate-limit rapid repeat requests.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const isRateLimited = createRateLimiter(WINDOW_MS, MAX_REQUESTS_PER_WINDOW);

function json(body: RecognizeResponse, status: number) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  if (isRateLimited(clientKey(req))) {
    return json(
      { success: false, error: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." },
      429,
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ success: false, error: "잘못된 요청입니다." }, 400);
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return json({ success: false, error: "이미지 파일이 필요합니다." }, 400);
  }

  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return json(
      { success: false, error: "지원하지 않는 형식입니다. JPG, PNG, WEBP 파일을 올려주세요." },
      415,
    );
  }

  if (file.size === 0) {
    return json({ success: false, error: "빈 파일입니다. 다른 사진을 올려주세요." }, 400);
  }

  if (file.size > MAX_FILE_BYTES) {
    return json(
      { success: false, error: `파일이 너무 큽니다. ${MAX_FILE_MB}MB 이하의 사진을 올려주세요.` },
      413,
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
    const { ingredients, model } = await recognizeIngredients(dataUrl);
    // `model` is logged for observability only — the response contract
    // exposes just `success`/`ingredients`, nothing more.
    console.log(`[ingredients/recognize] model=${model} count=${ingredients.length}`);
    return json({ success: true, ingredients }, 200);
  } catch (err) {
    if (err instanceof OpenRouterError) {
      return json(
        { success: false, error: err.message },
        err.status >= 400 && err.status < 600 ? err.status : 500,
      );
    }
    console.error("Unexpected error in /api/ingredients/recognize:", err);
    return json(
      { success: false, error: "예상치 못한 오류가 발생했습니다. 다시 시도해 주세요." },
      500,
    );
  }
}
