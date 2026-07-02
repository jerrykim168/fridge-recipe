---
name: deepseek-json-quirk
description: DeepSeek on OpenRouter ignores response_format json_object; wraps output in code fences — defensive parsing required
metadata:
  type: project
---

`deepseek/deepseek-chat` on OpenRouter resolves to `deepseek-chat-v3` (served by provider StreamLake) and does NOT reliably honor `response_format: { type: "json_object" }` — it wraps the JSON payload in ```json … ``` code fences and can add prose.

**Why:** Confirmed by live e2e testing during Step 2 (recipe generation). The `openai/gpt-4o-mini` vision model (Step 1) honors json_object cleanly; DeepSeek does not. Korean cooking output quality is strong and cost is ~$0.0004 per 3-recipe call, so DeepSeek was still the right default for text generation.

**How to apply:** Any DeepSeek text integration in this project must parse defensively — never trust the flag. Reuse the first-`{`..last-`}` slice approach (`extractJsonObject` in `lib/openrouter.ts`) plus per-field validation, and drop malformed items rather than surfacing them. If a future feature needs guaranteed strict JSON, prefer `openai/gpt-4o-mini` over DeepSeek. Model is swappable via `OPENROUTER_RECIPE_MODEL`. Minor caveat: with very few input ingredients the model may name dishes using ingredients not provided (e.g. single "두부" input → 김치찌개) — acceptable within PRD_step2 scope. Related: [[openrouter-conventions]].
