import { NextRequest, NextResponse } from "next/server";
import type { AuthResponse, LoginRequest } from "@/lib/constants";
import { userRepository } from "@/lib/repositories";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validate";
import { clientKey, createRateLimiter } from "@/lib/security/rateLimit";

// Contract (see lib/constants.ts):
//   POST /api/auth/login   Request: { email, password } -> AuthResponse

export const runtime = "nodejs";

// Tighter than signup — this is the endpoint a credential-stuffing attempt
// would hammer.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const isRateLimited = createRateLimiter(WINDOW_MS, MAX_REQUESTS_PER_WINDOW);

const INVALID_CREDENTIALS_ERROR =
  "이메일 또는 비밀번호가 올바르지 않습니다.";

function json(body: AuthResponse, status: number) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientKey(request))) {
    return json(
      { success: false, error: "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요." },
      429,
    );
  }

  let body: Partial<LoginRequest> | null = null;
  try {
    body = (await request.json()) as Partial<LoginRequest>;
  } catch {
    body = null;
  }

  const email =
    typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isValidEmail(email) || password.length === 0) {
    // Same generic message as a real mismatch below — don't help an
    // attacker distinguish "malformed input" from "wrong password".
    return json({ success: false, error: INVALID_CREDENTIALS_ERROR }, 400);
  }

  try {
    const user = await userRepository.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return json({ success: false, error: INVALID_CREDENTIALS_ERROR }, 401);
    }

    const { token, expiresAtMs } = await createSession(user.id);

    const response = NextResponse.json<AuthResponse>(
      {
        success: true,
        user: { id: user.id, email: user.email, createdAt: user.createdAt },
      },
      { status: 200 },
    );
    setSessionCookie(response, token, expiresAtMs);
    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    return json(
      {
        success: false,
        error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      500,
    );
  }
}
