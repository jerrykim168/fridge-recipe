import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  destroySessionByToken,
  getSessionTokenFromRequest,
} from "@/lib/auth/session";

// Contract (see lib/constants.ts):
//   POST /api/auth/logout   Request: (none) -> { success: boolean }
// Always clears the cookie and returns success, even if there was no/invalid
// session to begin with — logging out an already-logged-out client isn't an
// error from the caller's point of view.

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = getSessionTokenFromRequest(request);
  if (token) {
    try {
      await destroySessionByToken(token);
    } catch (err) {
      console.error("[auth/logout]", err);
    }
  }

  const response = NextResponse.json({ success: true }, { status: 200 });
  clearSessionCookie(response);
  return response;
}
