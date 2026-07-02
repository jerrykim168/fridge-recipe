---
name: project-rate-limiter-xff-bypass
description: All in-memory rate limiters in this project trust the client-supplied X-Forwarded-For header, making them bypassable/unreliable unless deployed behind a proxy that sanitizes it.
metadata:
  type: project
---

Every rate limiter in this codebase (lib/security/rateLimit.ts, used by
app/api/auth/{signup,login}/route.ts, plus inline copies in
app/api/ingredients/recognize/route.ts and app/api/recipes/generate/route.ts)
keys on `clientKey()`, which reads `X-Forwarded-For` directly from the
incoming request and trusts the first value verbatim:

```ts
function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}
```

Confirmed by direct testing (2026-07-02): sending a different
`X-Forwarded-For` value on every request to `/api/auth/login` let 12
consecutive requests through with zero 429s, while the same test without a
spoofed header correctly triggered 429 after 8 requests (limit was 8/window).

**Why this matters:** unless the app runs behind a reverse proxy that
strips/overwrites client-supplied `X-Forwarded-For` (e.g. Vercel's edge does
this correctly; a bare `next start` on a VM does not), any attacker can
brute-force login/signup, or hammer the paid OpenRouter-backed endpoints,
by rotating a fake header value per request. It also *over-limits* honest
users if the app is NOT behind such a proxy and no header is sent at all —
every visitor collapses onto the same `"local"` bucket and can rate-limit
each other.

There's a secondary issue baked into the same code path: the `hits` Map
never evicts keys, so an attacker rotating fake IPs also causes unbounded
memory growth (a mild DoS vector), independent of the trust issue.

**How to apply:** Before any production deployment, confirm what's actually
in front of the Node process (Vercel / nginx / raw). If there's no trusted
proxy normalizing `X-Forwarded-For`, this is a live, exploitable
brute-force gap on `/api/auth/login` in particular. This is an
architecture/deployment decision (see [[feedback_architecture_needs_confirmation]]
in the top-level user memory) — don't silently patch the trust boundary;
confirm the deployment target first, since the correct fix depends on it
(e.g. Vercel: use a header Vercel itself sets and can't be spoofed from the
public internet; self-hosted: need a real reverse proxy or accept
best-effort-only limiting).
