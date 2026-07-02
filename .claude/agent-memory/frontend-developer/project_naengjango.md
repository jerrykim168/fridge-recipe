---
name: project-naengjango
description: "냉장고를 부탁해" 3-step recipe app — agent division of labor and Step 1 API contract
metadata:
  type: project
---

"냉장고를 부탁해" = 냉장고 사진 → 재료 인식 → 레시피 추천 웹앱. 3단계 PRD (PRD_step1/2/3.md). Stack: Next.js 14 App Router + TypeScript (frontend + API routes in one project).

**Division of labor (multi-agent):** frontend-developer owns the UI only (app/page.tsx, app/*.css, app/layout.tsx). backend-architect owns server API routes under app/api/** and lib/openrouter.ts. Shared: lib/constants.ts (validation limits + response types).

**Why:** A coordinator splits UI vs server work between agents to avoid conflicts.
**How to apply:** Do NOT edit app/api/** or lib/openrouter.ts — that's backend-architect's. Coordinate via the shared contract, not by editing their files.

**Step 1 API contract:** `POST /api/ingredients/recognize`, request multipart/form-data field `image`; success `{ success: true, ingredients: string[] }`, error `{ success: false, error: string }` (4xx/5xx). OpenRouter key env var = `OPENROUTER_API_KEY` (server-only, never expose to client). Recipe generation is Step 2 (out of scope for Step 1).
