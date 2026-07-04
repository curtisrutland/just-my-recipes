import { isAuthorized, isPrimaryKey } from "@/lib/auth";
import { revalidateForRecipe } from "@/lib/cache-tags";
import { errorResponse, notFound, unauthorized, validationErrorResponse } from "@/lib/errors";
import {
  deleteRecipe,
  getRecipeRow,
  serializeRecipe,
  updateRecipe,
} from "@/lib/queries";
import { recipeWriteSchema } from "@/lib/recipe";

type Ctx = { params: Promise<{ slug: string }> };

// GET /api/recipes/{slug} — public. Drafts 404 without a valid key.
export async function GET(request: Request, { params }: Ctx) {
  const { slug } = await params;
  const row = await getRecipeRow(slug);
  if (!row) return notFound();
  if (row.visibility !== "public" && !isAuthorized(request)) return notFound();
  return Response.json(serializeRecipe(row));
}

// PUT /api/recipes/{slug} — full replace (auth). `visibility` updatable.
export async function PUT(request: Request, { params }: Ctx) {
  if (!isAuthorized(request)) return unauthorized();
  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = recipeWriteSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { visibility, ...doc } = parsed.data;
  const row = await updateRecipe(slug, doc, visibility);
  if (!row) return notFound();
  revalidateForRecipe(row.slug);

  return Response.json(serializeRecipe(row));
}

// DELETE /api/recipes/{slug} — hard delete. Requires the PRIMARY key, not the
// Skill's publish token, so permanent deletion stays an owner-only operation.
export async function DELETE(request: Request, { params }: Ctx) {
  if (!isPrimaryKey(request)) return unauthorized();
  const { slug } = await params;

  const deleted = await deleteRecipe(slug);
  if (!deleted) return notFound();
  revalidateForRecipe(slug);

  return new Response(null, { status: 204 });
}
