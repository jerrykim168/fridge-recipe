---
name: openrouter-conventions
description: This project's OpenRouter integration conventions — shared key, per-feature model env vars, server-only client, error/parse patterns
metadata:
  type: project
---

"냉장고를 부탁해" (Next.js 14 App Router, TS) OpenRouter conventions:

- Single shared secret `OPENROUTER_API_KEY` reused across all features; per-feature model overrides via env: `OPENROUTER_VISION_MODEL` (Step 1, default `openai/gpt-4o-mini`), `OPENROUTER_RECIPE_MODEL` (Step 2, default `deepseek/deepseek-chat`).
- All OpenRouter calls go through the `server-only` client `lib/openrouter.ts`; shared `OpenRouterError { retryable, status }` maps upstream failures to HTTP. Route handlers (`app/api/**/route.ts`) use `runtime = "nodejs"`, a per-process in-memory rate limiter (10 req / 60s), and Korean user-facing error copy.
- Shared request/response contract types live in `lib/constants.ts` and are imported by both routes and the frontend agent.
- `X-Title` header must be percent-encoded (contains Korean) or undici throws a ByteString error. Never log the API key or upstream response bodies.

**Why:** Established in Step 1, extended in Step 2. Backend and frontend are built by separate agents that coordinate through `lib/constants.ts`.

**How to apply:** Follow these exact patterns for any new LLM feature (Step 3 save/auth etc.) rather than inventing new conventions. See [[deepseek-json-quirk]] for the DeepSeek parsing gotcha.
