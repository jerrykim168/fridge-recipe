import { NextRequest, NextResponse } from "next/server";
import type { MeResponse } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth/session";

// Contract (see lib/constants.ts):
//   GET /api/auth/me -> MeResponse, `user: null` when not logged in.
// Always 200 — "not logged in" is a normal, expected state here, not an
// error (matches how context/AuthContext.tsx consumes this).

export const runtime = "nodejs";
// Depends on the per-request session cookie — must never be cached/shared
// across users.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const body: MeResponse = { success: true, user };
    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    console.error("[auth/me]", err);
    // Fail closed: treat lookup errors as "not logged in" rather than
    // surfacing a 500 for what the UI treats as a routine status check.
    const body: MeResponse = { success: true, user: null };
    return NextResponse.json(body, { status: 200 });
  }
}
