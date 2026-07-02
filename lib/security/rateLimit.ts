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
    return recent.length > maxPerWindow;
  };
}

export function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local";
}
