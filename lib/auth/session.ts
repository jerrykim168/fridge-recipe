import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { AuthUser } from "@/lib/constants";
import { sessionRepository, userRepository } from "@/lib/repositories";

// httpOnly-cookie session, backed by the `sessions` table. The cookie only
// ever carries a random opaque token; the DB stores a SHA-256 hash of it, so
// a leaked DB row alone can't be replayed as a valid session (NFR-2).

export const SESSION_COOKIE_NAME = "fridge_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TOKEN_BYTES = 32; // 256 bits — unguessable (NFR-2)

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // `secure` requires HTTPS; disabled outside production so local
    // http://localhost dev keeps working.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds } : {}),
  };
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAtMs: number }> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAtMs = Date.now() + SESSION_TTL_MS;

  await sessionRepository.create({
    userId,
    tokenHash: hashToken(token),
    expiresAtMs,
  });
  // Opportunistic housekeeping — cheap, and keeps the table from growing
  // unbounded without needing a cron job.
  void sessionRepository.deleteExpired(Date.now());

  return { token, expiresAtMs };
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAtMs: number,
): void {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((expiresAtMs - Date.now()) / 1000),
  );
  response.cookies.set(SESSION_COOKIE_NAME, token, cookieOptions(maxAgeSeconds));
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", cookieOptions(0));
}

/** Resolves the caller's session cookie to the current user, or null. */
export async function getCurrentUser(
  request: NextRequest,
): Promise<AuthUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await sessionRepository.findByTokenHash(hashToken(token));
  if (!session || session.expiresAt <= Date.now()) return null;

  const user = await userRepository.findById(session.userId);
  if (!user) return null;

  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export async function destroySessionByToken(token: string): Promise<void> {
  await sessionRepository.deleteByTokenHash(hashToken(token));
}

export function getSessionTokenFromRequest(
  request: NextRequest,
): string | undefined {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value;
}
