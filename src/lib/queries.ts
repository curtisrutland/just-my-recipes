import { and, desc, eq, sql } from "drizzle-orm";
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
  limit: number;
  offset: number;
  includeDrafts: boolean;
};

export async function listRecipeRows(opts: ListOptions): Promise<RecipeRow[]> {
  const conds = [];
  if (!opts.includeDrafts) conds.push(eq(recipes.visibility, "public"));
  if (opts.tag) conds.push(sql`${opts.tag.toLowerCase()} = ANY(${recipes.tags})`);
  return db
    .select()
    .from(recipes)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(recipes.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);
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
