import { NextRequest, NextResponse } from "next/server";
import type {
  AuthError,
  DeleteRecipeResponse,
  ListSavedResponse,
  SaveRecipeRequest,
  SaveRecipeResponse,
  SavedRecipe,
} from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { savedRecipeRepository } from "@/lib/repositories";
import { isValidRecipe } from "@/lib/recipes/validate";

// Contract (see lib/constants.ts):
//   POST   /api/recipes/save  Request: { recipe: Recipe } -> SaveRecipeResponse
//   GET    /api/recipes/save  -> ListSavedResponse (current user only, FR-3.2)
//   DELETE /api/recipes/save?id=<id> -> DeleteRecipeResponse (ownership enforced)
//
// Every handler requires a valid session — FR-0.2. The session's user id is
// the *only* source of ownership; a client-supplied id is never trusted for
// scoping a query (FR-3.2/FR-4, avoids IDOR).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAUTHENTICATED: AuthError = {
  success: false,
  error: "로그인이 필요합니다.",
};

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

    let body: Partial<SaveRecipeRequest> | null = null;
    try {
      body = (await request.json()) as Partial<SaveRecipeRequest>;
    } catch {
      body = null;
    }

    if (!body || !isValidRecipe(body.recipe)) {
      const payload: SaveRecipeResponse = {
        success: false,
        error: "레시피 데이터가 올바르지 않습니다.",
      };
      return NextResponse.json(payload, { status: 400 });
    }

    const record = await savedRecipeRepository.create(user.id, body.recipe);
    const recipe: SavedRecipe = {
      id: record.id,
      name: record.name,
      ingredients: record.ingredients,
      steps: record.steps,
      estimatedTime: record.estimatedTime,
      difficulty: record.difficulty,
      servings: record.servings,
      savedAt: record.savedAt,
    };
    const payload: SaveRecipeResponse = { success: true, recipe };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[recipes/save][POST]", err);
    const payload: SaveRecipeResponse = {
      success: false,
      error: "레시피를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
    return NextResponse.json(payload, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

    const records = await savedRecipeRepository.listByUser(user.id);
    const recipes: SavedRecipe[] = records.map((r) => ({
      id: r.id,
      name: r.name,
      ingredients: r.ingredients,
      steps: r.steps,
      estimatedTime: r.estimatedTime,
      difficulty: r.difficulty,
      servings: r.servings,
      savedAt: r.savedAt,
    }));

    const payload: ListSavedResponse = { success: true, recipes };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[recipes/save][GET]", err);
    const payload: ListSavedResponse = {
      success: false,
      error: "저장한 레시피를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
    return NextResponse.json(payload, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json(UNAUTHENTICATED, { status: 401 });

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      const payload: DeleteRecipeResponse = {
        success: false,
        error: "삭제할 레시피 id가 필요합니다.",
      };
      return NextResponse.json(payload, { status: 400 });
    }

    const deleted = await savedRecipeRepository.deleteForUser(id, user.id);
    if (!deleted) {
      // Same message whether the id never existed or belongs to someone
      // else — don't leak which, that's an IDOR/enumeration hint (FR-4).
      const payload: DeleteRecipeResponse = {
        success: false,
        error: "레시피를 찾을 수 없습니다.",
      };
      return NextResponse.json(payload, { status: 404 });
    }

    const payload: DeleteRecipeResponse = { success: true };
    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[recipes/save][DELETE]", err);
    const payload: DeleteRecipeResponse = {
      success: false,
      error: "레시피를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
    return NextResponse.json(payload, { status: 500 });
  }
}
