import { cacheLife, cacheTag } from "next/cache";
import { INDEX_TAG, recipeTag } from "./cache-tags";
import { formatDuration } from "./format";
import { PAGE_SIZE } from "./pagination";
import {
  countRecipes,
  getPublicTags,
  getRecipeRow,
  listRecipeRows,
  type Visibility,
} from "./queries";
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

/**
 * First static page of the public index + the total count, for the home landing.
 * The first `PAGE_SIZE` recipes render statically (fast, SEO); `RecipeBrowser`
 * then fetches further pages / search results from the API. `total` drives whether
 * a "Load more" button is shown.
 */
export async function getInitialIndex(): Promise<{
  items: RecipeListItem[];
  total: number;
}> {
  "use cache";
  cacheTag(INDEX_TAG);
  cacheLife("max");
  const opts = { limit: PAGE_SIZE, offset: 0, includeDrafts: false };
  const [rows, total] = await Promise.all([
    listRecipeRows(opts),
    countRecipes(opts),
  ]);
  return { items: rows.map(toListItem), total };
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

export type RecipeDetail = {
  slug: string;
  data: RecipeJsonLd;
  visibility: Visibility;
};

/**
 * The detail-page read. Returns a recipe of EITHER visibility so a draft is
 * viewable by direct URL (for owner preview) with a "Draft" badge + `noindex` —
 * drafts stay out of every listing/tag view (those are public-only) but are
 * reachable if you know the slug. `recipeTag(slug)` still busts this on any write,
 * so a publish/edit reflects immediately. Returns null only when the slug is gone.
 */
export async function getViewableRecipe(slug: string): Promise<RecipeDetail | null> {
  "use cache";
  cacheTag(recipeTag(slug));
  cacheLife("max");
  const row = await getRecipeRow(slug);
  if (!row) return null;
  return { slug: row.slug, data: row.data, visibility: row.visibility };
}
