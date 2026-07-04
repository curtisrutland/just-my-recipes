import { revalidateTag } from "next/cache";

/** Tag carried by every listing (index + each tag view). */
export const INDEX_TAG = "recipes-index";

/** Per-recipe tag carried by that recipe's detail page. */
export const recipeTag = (slug: string) => `recipe:${slug}`;

/**
 * On-demand revalidation for a write: refreshes the index and every tag view
 * (all carry INDEX_TAG) plus this recipe's detail page.
 */
export function revalidateForRecipe(slug: string): void {
  // Second arg = stale-while-revalidate window; "max" gives the longest.
  revalidateTag(INDEX_TAG, "max");
  revalidateTag(recipeTag(slug), "max");
}
