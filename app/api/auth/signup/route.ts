import { NextRequest, NextResponse } from "next/server";
import {
  MIN_PASSWORD_LENGTH,
  type AuthResponse,
  type SignupRequest,
} from "@/lib/constants";
import { userRepository } from "@/lib/repositories";
import { hashPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { isValidEmail, normalizeEmail } from "@/lib/auth/validate";
import { clientKey, createRateLimiter } from "@/lib/security/rateLimit";

// Contract (see lib/constants.ts):
//   POST /api/auth/signup   Request: { email, password } -> AuthResponse
//   On success: sets the httpOnly session cookie and returns the new user.

export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const isRateLimited = createRateLimiter(WINDOW_MS, MAX_REQUESTS_PER_WINDOW);

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

  let body: Partial<SignupRequest> | null = null;
  try {
    body = (await request.json()) as Partial<SignupRequest>;
  } catch {
    body = null;
  }

  const email =
    typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isValidEmail(email)) {
    return json(
      { success: false, error: "올바른 이메일 주소를 입력해 주세요." },
      400,
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json(
      {
        success: false,
        error: `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
      },
      400,
    );
  }

  try {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      return json(
        { success: false, error: "이미 가입된 이메일입니다." },
        409,
      );
    }

    const passwordHash = hashPassword(password);
    const user = await userRepository.create({ email, passwordHash });
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
    console.error("[auth/signup]", err);
    return json(
      {
        success: false,
        error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      500,
    );
  }
}
