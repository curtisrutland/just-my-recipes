import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import {
  recipes,
  users,
  type NewRecipeRow,
  type RecipeRow,
} from "./db/schema";
import { deriveTags, type RecipeJsonLd } from "./recipe";
import { dedupeSlug, slugify } from "./slug";

export type Visibility = "public" | "draft";

/** Resolve the single owner's id, creating the row from env on first write. */
async function ensureOwnerId(): Promise<string> {
  const email = process.env.OWNER_EMAIL;
  if (!email) throw new Error("OWNER_EMAIL is not set");
  const name = process.env.OWNER_NAME ?? email;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const created = await db
    .insert(users)
    .values({ email, name })
    .onConflictDoUpdate({ target: users.email, set: { name } })
    .returning({ id: users.id });
  return created[0].id;
}

/** Generate a unique slug from the name, deduping with a numeric suffix. */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const rows = await db
    .select({ slug: recipes.slug })
    .from(recipes)
    .where(sql`${recipes.slug} = ${base} OR ${recipes.slug} LIKE ${base + "-%"}`);
  const taken = new Set(rows.map((r) => r.slug));
  return dedupeSlug(base, taken);
}

export type ListOptions = {
  tag?: string;
  q?: string;
  limit: number;
  offset: number;
  includeDrafts: boolean;
};

/**
 * WHERE conditions shared by `listRecipeRows` and `countRecipes`, so the page and
 * the total count always filter identically.
 *
 * `q` is free-text, case-insensitive substring over name (via the denormalized
 * `title` column), `description`, `notes`, and any single `recipeIngredient` line.
 * Deliberately NOT over keywords/category/cuisine (that's what `tag` is for) or
 * instructions/nutrition. Plain `ILIKE` — `unaccent` is not enabled on the DB, so
 * accent-insensitivity is a future nicety, not this phase. `tag` and `q` compose as AND.
 */
function recipeFilters(opts: ListOptions): SQL[] {
  const conds: SQL[] = [];
  if (!opts.includeDrafts) conds.push(eq(recipes.visibility, "public"));
  if (opts.tag) conds.push(sql`${opts.tag.toLowerCase()} = ANY(${recipes.tags})`);
  const q = opts.q?.trim();
  if (q) {
    const needle = `%${q}%`;
    conds.push(sql`(
      ${recipes.title} ILIKE ${needle}
      OR ${recipes.data}->>'description' ILIKE ${needle}
      OR ${recipes.data}->>'notes' ILIKE ${needle}
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(${recipes.data}->'recipeIngredient') AS ing
        WHERE ing ILIKE ${needle}
      )
    )`);
  }
  return conds;
}

export async function listRecipeRows(opts: ListOptions): Promise<RecipeRow[]> {
  const conds = recipeFilters(opts);
  return db
    .select()
    .from(recipes)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(recipes.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);
}

/** Total rows matching the same filters, ignoring limit/offset — for `count`. */
export async function countRecipes(opts: ListOptions): Promise<number> {
  const conds = recipeFilters(opts);
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(recipes)
    .where(conds.length ? and(...conds) : undefined);
  return Number(rows[0]?.n ?? 0);
}

export async function getRecipeRow(slug: string): Promise<RecipeRow | null> {
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function createRecipe(
  doc: RecipeJsonLd,
  visibility: Visibility,
): Promise<RecipeRow> {
  const ownerId = await ensureOwnerId();
  const slug = await uniqueSlug(doc.name);
  const rows = await db
    .insert(recipes)
    .values({
      ownerId,
      slug,
      title: doc.name,
      tags: deriveTags(doc),
      visibility,
      data: doc,
    })
    .returning();
  return rows[0];
}

/** Full document replace. Slug is immutable, so it is never changed here. */
export async function updateRecipe(
  slug: string,
  doc: RecipeJsonLd,
  visibility?: Visibility,
): Promise<RecipeRow | null> {
  const set: Partial<NewRecipeRow> = {
    title: doc.name,
    tags: deriveTags(doc),
    data: doc,
    updatedAt: new Date(),
  };
  if (visibility) set.visibility = visibility;
  const rows = await db
    .update(recipes)
    .set(set)
    .where(eq(recipes.slug, slug))
    .returning();
  return rows[0] ?? null;
}

/**
 * Flip only the visibility column (publish/unpublish). Unlike `updateRecipe`,
 * this touches nothing in the JSONB `data` or denormalized `title`/`tags`, so a
 * toggle can never mangle the document. Returns false if no such slug.
 */
export async function setRecipeVisibility(
  slug: string,
  visibility: Visibility,
): Promise<boolean> {
  const rows = await db
    .update(recipes)
    .set({ visibility, updatedAt: new Date() })
    .where(eq(recipes.slug, slug))
    .returning({ slug: recipes.slug });
  return rows.length > 0;
}

export async function deleteRecipe(slug: string): Promise<boolean> {
  const rows = await db
    .delete(recipes)
    .where(eq(recipes.slug, slug))
    .returning({ slug: recipes.slug });
  return rows.length > 0;
}

export async function getPublicSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: recipes.slug })
    .from(recipes)
    .where(eq(recipes.visibility, "public"));
  return rows.map((r) => r.slug);
}

export async function getPublicTags(): Promise<string[]> {
  const rows = await db
    .select({ tags: recipes.tags })
    .from(recipes)
    .where(eq(recipes.visibility, "public"));
  const set = new Set<string>();
  for (const r of rows) for (const t of r.tags) set.add(t);
  return [...set].sort();
}

/** Response document: server-managed fields alongside the JSON-LD data. */
export function serializeRecipe(row: RecipeRow) {
  return {
    slug: row.slug,
    visibility: row.visibility,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...row.data,
  };
}
