"use server";

import { revalidatePath } from "next/cache";
import { assertOwner } from "@/lib/admin/auth";
import { revalidateForRecipe } from "@/lib/cache-tags";
import {
  deleteRecipe,
  getRecipeRow,
  setRecipeVisibility,
} from "@/lib/queries";

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
