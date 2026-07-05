import type { RecipeJsonLd } from "./recipe";

/**
 * Tag chips beyond this many collapse behind the tag cloud's "Show all" toggle.
 * Lives here (a server-safe module) rather than in the `"use client"` TagCloud
 * so server components can read the actual value — a constant imported from a
 * client module across the RSC boundary is a client reference, not the number.
 */
export const TAG_CLOUD_COLLAPSED = 12;

/**
 * Original-case tag labels for display (pills), deduped case-insensitively.
 * The stored `tags` column is lowercased for querying; these preserve the
 * author's casing purely for presentation.
 */
export function displayTags(doc: RecipeJsonLd): string[] {
  const source = [
    ...(doc.recipeCategory ?? []),
    ...(doc.recipeCuisine ?? []),
    ...(doc.keywords ?? []),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of source) {
    const label = raw.trim();
    const key = label.toLowerCase();
    if (label && !seen.has(key)) {
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

/** The `#weeknight` display form used in list rows (non-alphanumerics stripped). */
export function hashtag(tag: string): string {
  return "#" + tag.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Route to a tag view. Tags are lowercased in storage and in URLs. */
export function tagHref(tag: string): string {
  return `/tags/${encodeURIComponent(tag.toLowerCase())}`;
}

export function tagsEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
