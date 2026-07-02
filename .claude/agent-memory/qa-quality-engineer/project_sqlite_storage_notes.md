---
name: project-sqlite-storage-notes
description: Step 3 storage uses node:sqlite (DatabaseSync) as a deliberate interim choice before a planned future Supabase migration — has deployment implications.
metadata:
  type: project
---

`lib/db/client.ts` uses Node's built-in `node:sqlite` (`DatabaseSync`),
writing to `data/app.db` on local disk, reused across dev hot-reloads via
`globalThis.__fridgeDb`. This was a deliberate choice (see
`NOTES_FOR_REVIEW.md` in the repo root) to avoid native-module build
tooling on Windows dev machines, with `lib/repositories/*` designed as a
storage-agnostic seam specifically so a future Supabase migration only
means adding `lib/repositories/supabase/*` and swapping three exports in
`lib/repositories/index.ts` — route handlers never touch SQLite directly.

**Why this matters for QA:** `node:sqlite` is synchronous under the hood
(wrapped in `Promise`-returning interface methods for future-proofing, but
each call blocks the Node event loop while it runs). For this app's scale
(single small SQLite file, low concurrency) this is not a measured
bottleneck — worth re-checking if traffic ever grows. More importantly: a
file-based SQLite DB is incompatible with serverless/ephemeral-filesystem
deployment targets (e.g. Vercel's default Node runtime resets `/data` on
every cold start / can't share it across instances). If the user ever asks
about deploying this to Vercel as-is, flag this before they push — it will
silently lose all signups/saved recipes on redeploy or scale-out. The
Supabase migration path already designed in `lib/repositories` is the
intended fix; check whether it's been done before assuming SQLite is still
in use.

**How to apply:** When reviewing this project post-migration, re-verify
which repository implementation `lib/repositories/index.ts` actually
exports before assuming SQLite-specific caveats (locking, sync I/O, file
path) still apply.
