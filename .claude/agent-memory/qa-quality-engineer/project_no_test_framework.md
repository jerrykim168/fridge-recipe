---
name: project-no-test-framework
description: No Jest/Vitest/test runner configured in package.json — all QA verification here is manual (tsc --noEmit + curl smoke tests + browser checks), not automated regression tests.
metadata:
  type: project
---

`package.json` has only `dev` / `build` / `start` / `lint` scripts — no test
runner, no test files anywhere in the repo. Verified 2026-07-02.

**Why this matters:** every QA pass on this project has to manually
re-verify pure-logic functions by hand (curl or ad-hoc node -e scripts)
since there's no regression suite to run. The highest-value candidates for
unit tests, if a framework is ever added, are the pure functions with real
edge-case surface: `parseRecipes` / `parseIngredients` /
`stripLeadingStepNumber` in `lib/openrouter.ts` (regex/parsing logic, prone
to silent regressions — this project already had one real bug here, the
duplicated step-number prefix, fixed and documented in
`NOTES_FOR_REVIEW.md`), and `hashPassword` / `verifyPassword` in
`lib/auth/password.ts`.

**How to apply:** Don't assume "tests pass" as a completeness signal for
this repo — there are none. Rely on `npx tsc --noEmit` for type safety and
direct curl/browser exercises for behavior. If asked to improve test
coverage, Vitest is a lighter add than Jest for a Next.js 14 + TS project
this size and needs no native deps (consistent with the project's existing
"avoid native build tooling on Windows" constraint — see
[[project_sqlite_storage_notes]]).
