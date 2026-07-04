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
import { recipeWriteSchema } from "@/lib/recipe";

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
  redirect("/admin");
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
