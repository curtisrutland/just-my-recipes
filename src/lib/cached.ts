import { cacheLife, cacheTag } from "next/cache";
import { INDEX_TAG, recipeTag } from "./cache-tags";
import { formatDuration } from "./format";
import { getPublicTags, getRecipeRow, listRecipeRows } from "./queries";
import type { RecipeRow } from "./db/schema";
import type { RecipeJsonLd } from "./recipe";

/**
 * Page-facing reads. Each wraps a DB query in `use cache` and tags it so
 * writes can invalidate precisely via `revalidateForRecipe`:
 *   - listings (index + tag views) carry INDEX_TAG
 *   - a detail page carries its per-recipe tag
 * `cacheLife("max")` keeps pages static until a tag is revalidated.
 */

export type RecipeListItem = {
  slug: string;
  title: string;
  tags: string[];
  totalTime?: string;
  image?: string;
};

function toListItem(row: RecipeRow): RecipeListItem {
  return {
    slug: row.slug,
    title: row.title,
    tags: row.tags,
    totalTime: formatDuration(row.data.totalTime),
    image: row.data.image,
  };
}

export async function getIndexRecipes(): Promise<RecipeListItem[]> {
  "use cache";
  cacheTag(INDEX_TAG);
  cacheLife("max");
  const rows = await listRecipeRows({
    limit: 1000,
    offset: 0,
    includeDrafts: false,
  });
  return rows.map(toListItem);
}

export async function getTagRecipes(tag: string): Promise<RecipeListItem[]> {
  "use cache";
  cacheTag(INDEX_TAG);
  cacheLife("max");
  const rows = await listRecipeRows({
    tag,
    limit: 1000,
    offset: 0,
    includeDrafts: false,
  });
  return rows.map(toListItem);
}

export async function getAllTags(): Promise<string[]> {
  "use cache";
  cacheTag(INDEX_TAG);
  cacheLife("max");
  return getPublicTags();
}

export type RecipeDetail = { slug: string; data: RecipeJsonLd };

export async function getPublicRecipe(slug: string): Promise<RecipeDetail | null> {
  "use cache";
  cacheTag(recipeTag(slug));
  cacheLife("max");
  const row = await getRecipeRow(slug);
  if (!row || row.visibility !== "public") return null;
  return { slug: row.slug, data: row.data };
}
