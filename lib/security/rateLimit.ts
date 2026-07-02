import type { NextRequest } from "next/server";

// Minimal in-memory rate limiter — per-process only, mirrors the pattern
// already used in app/api/recipes/generate and app/api/ingredients/recognize.
// Fine for a single server instance; swap for a shared store (Redis/Upstash)
// if this ever runs behind multiple instances.
//
// Used on the auth routes primarily to slow down password-guessing attempts
// against a single account/IP (NFR-2), not just external-API cost control.

export function createRateLimiter(windowMs: number, maxPerWindow: number) {
  const hits = new Map<string, number[]>();

  return function isRateLimited(key: string): boolean {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);

    // Bound memory: sweep stale entries once the map gets large enough that
    // an attacker cycling through fake keys would matter. Cheap relative to
    // how rarely it runs.
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (times.every((t) => now - t >= windowMs)) hits.delete(k);
      }
    }

    return recent.length > maxPerWindow;
  };
}

export function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (!fwd) return "local";
  // On Vercel (and any standard reverse-proxy setup), each hop *appends* its
  // own view of the client IP, so the header reads
  // "<client-supplied>, ..., <real-ip-added-by-our-proxy>". The first entry
  // is whatever the client claims and is trivially spoofable; only the last
  // entry is the one our own infrastructure appended and can be trusted.
  const parts = fwd.split(",").map((p) => p.trim());
  return parts[parts.length - 1] || "local";
}
