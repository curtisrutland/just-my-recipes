import { isAuthorized } from "@/lib/auth";
import { revalidateForRecipe } from "@/lib/cache-tags";
import { errorResponse, unauthorized, validationErrorResponse } from "@/lib/errors";
import { countRecipes, createRecipe, listRecipeRows, serializeRecipe } from "@/lib/queries";
import { recipeWriteSchema } from "@/lib/recipe";

function clampInt(raw: string | null, fallback: number, min: number, max: number) {
  if (raw == null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// GET /api/recipes — public list. `?tag=`, `?q=` (free-text), `?limit=` (default
// 50, max 100), `?offset=`. With a valid key + `?include=drafts`, drafts are
// included. `count` is the total matching rows (ignores limit/offset).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tag = params.get("tag") ?? undefined;
  const q = params.get("q") ?? undefined;
  const includeDrafts =
    params.get("include") === "drafts" && isAuthorized(request);
  const limit = clampInt(params.get("limit"), 50, 1, 100);
  const offset = clampInt(params.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

  const opts = { tag, q, limit, offset, includeDrafts };
  const [rows, count] = await Promise.all([listRecipeRows(opts), countRecipes(opts)]);
  return Response.json({
    recipes: rows.map(serializeRecipe),
    limit,
    offset,
    count,
  });
}

// POST /api/recipes — create (auth). Returns 201 with the created resource.
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = recipeWriteSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { visibility, ...doc } = parsed.data;
  const row = await createRecipe(doc, visibility ?? "draft");
  revalidateForRecipe(row.slug);

  return Response.json(serializeRecipe(row), {
    status: 201,
    headers: { Location: `/api/recipes/${row.slug}` },
  });
}
