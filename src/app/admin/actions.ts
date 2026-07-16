"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { assertOwner } from "@/lib/admin/auth";
import type { FieldIssue, SaveState } from "@/lib/admin/form-model";
import { revalidateForRecipe } from "@/lib/cache-tags";
import {
  createRecipe,
  deleteRecipe,
  getRecipeRow,
  setRecipeVisibility,
  updateRecipe,
} from "@/lib/queries";
import { recipeWriteSchema, toJsonLd } from "@/lib/recipe";
import { SITE_URL } from "@/lib/site";

function toIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

/**
 * Create a recipe from the authoring form. Validates with the SAME
 * `recipeWriteSchema` the REST API uses (single source of truth); on success
 * redirects to the dashboard, on failure returns field issues for the form.
 */
export async function createRecipeAction(
  _prev: SaveState,
  payload: unknown,
): Promise<SaveState> {
  await assertOwner();
  const parsed = recipeWriteSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, errors: toIssues(parsed.error) };
  const { visibility, ...doc } = parsed.data;
  const row = await createRecipe(doc, visibility ?? "draft");
  revalidateForRecipe(row.slug);
  revalidatePath("/admin");
  // Land on the new recipe's editor (not the list) so it can be refined right
  // away — the slug now exists and is shown.
  redirect(`/admin/${row.slug}/edit`);
}

/** Update an existing recipe (full-document replace; slug is immutable). */
export async function updateRecipeAction(
  slug: string,
  _prev: SaveState,
  payload: unknown,
): Promise<SaveState> {
  await assertOwner();
  const parsed = recipeWriteSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, errors: toIssues(parsed.error) };
  const { visibility, ...doc } = parsed.data;
  const row = await updateRecipe(slug, doc, visibility);
  if (!row) {
    return { ok: false, errors: [{ path: "", message: "Recipe not found." }] };
  }
  revalidateForRecipe(slug);
  revalidatePath("/admin");
  redirect("/admin");
}

/** Publish a recipe (draft → public). */
export async function publishRecipe(slug: string): Promise<void> {
  await assertOwner();
  await setRecipeVisibility(slug, "public");
  revalidateForRecipe(slug);
  revalidatePath("/admin");
}

/** Unpublish a recipe (public → draft). The only "delete" a live recipe allows. */
export async function unpublishRecipe(slug: string): Promise<void> {
  await assertOwner();
  await setRecipeVisibility(slug, "draft");
  revalidateForRecipe(slug);
  revalidatePath("/admin");
}

/**
 * Hard-delete a DRAFT. The unpublish-first rule is enforced HERE, not just in the
 * UI: we re-read the row and refuse unless it is currently a draft, so no stale
 * page, double-submit, or crafted request can ever destroy a published recipe.
 */
export async function deleteDraftRecipe(slug: string): Promise<void> {
  await assertOwner();
  const row = await getRecipeRow(slug);
  if (!row) return; // already gone — nothing to do
  if (row.visibility !== "draft") {
    throw new Error("Refusing to delete a published recipe — unpublish it first.");
  }
  await deleteRecipe(slug);
  revalidateForRecipe(slug);
  revalidatePath("/admin");
}

/** Result of a push-to-panel attempt, surfaced to the button. */
export type SendToPanelResult = { ok: true } | { ok: false; errors: string[] };

// The justmy.website kitchen-panel receiver. Sender-anonymous: it takes a
// JSON-LD Recipe (+ top-level `notes`) and validates/normalizes on receive, so
// we forward the recipe as-is and add no justmy.recipes-specific handshake.
const PANEL_ENDPOINT = "https://justmy.website/api/panel/recipe";

/**
 * Push a recipe to the justmy.website kitchen panel as its active recipe.
 *
 * A pure server→server forward — no DB write, no revalidation. The service
 * token lives in server env (`JMW_PANEL_SERVICE_TOKEN`) and NEVER reaches the
 * browser: the button only calls this action. We send exactly what the detail
 * page emits (`toJsonLd`, which already carries the top-level `notes`) and let
 * the panel validate/normalize on receive — we do not reshape it. Passive by
 * design: sending sets the panel's active recipe; nothing here navigates.
 */
export async function sendToPanel(slug: string): Promise<SendToPanelResult> {
  await assertOwner();

  const token = process.env.JMW_PANEL_SERVICE_TOKEN;
  if (!token) {
    return {
      ok: false,
      errors: ["Panel service token is not configured (JMW_PANEL_SERVICE_TOKEN)."],
    };
  }

  const row = await getRecipeRow(slug);
  if (!row) return { ok: false, errors: ["Recipe not found."] };

  const sourceUrl = `${SITE_URL}/recipes/${slug}`;
  const recipe = toJsonLd(row.data, sourceUrl);

  let res: Response;
  try {
    res = await fetch(PANEL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ recipe, sourceUrl }),
    });
  } catch {
    return {
      ok: false,
      errors: ["Couldn't reach the panel. Check the connection and try again."],
    };
  }

  if (res.ok) return { ok: true };

  // Surface the panel's own 400 validation errors verbatim — the user has a
  // keyboard and can fix the recipe. Anything else is a generic failure.
  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    const errors =
      Array.isArray(body?.errors) && body.errors.length > 0
        ? (body.errors as string[])
        : ["The panel rejected the recipe (400)."];
    return { ok: false, errors };
  }

  return { ok: false, errors: [`The panel returned an error (${res.status}).`] };
}
