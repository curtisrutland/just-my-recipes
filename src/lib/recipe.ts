import { z } from "zod";

/**
 * The accepted schema.org/Recipe subset — the SINGLE source of truth.
 *
 * `RecipeJsonLd` (the stored/served document type) is derived from this schema
 * via `z.infer`, so the validator and the type can never drift. Parsing:
 *   - strips any fields not listed here (Zod objects strip unknown keys),
 *   - validates ISO 8601 durations,
 *   - normalizes `recipeInstructions` (string[] | HowToStep[]) → HowToStep[],
 *   - normalizes category/cuisine/keywords (string | string[]) → string[].
 *
 * `name` and a non-empty `recipeIngredient` are the only required fields.
 * `notes` is a small, intentional addition to the schema.org subset (freeform
 * cook's notes surfaced on the detail page).
 */

// ISO 8601 duration, e.g. PT10M, PT1H30M, P1DT2H. Must contain at least one unit.
const ISO_8601_DURATION =
  /^P(?=\d|T\d)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?$/;

const duration = z
  .string()
  .trim()
  .regex(ISO_8601_DURATION, "Must be an ISO 8601 duration (e.g. PT35M)");

// string | string[] (or comma-separated string) → trimmed, non-empty string[]
const stringList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(",")))
  .transform((a) => a.map((s) => s.trim()).filter(Boolean));

const howToStep = z.object({
  "@type": z.literal("HowToStep").optional(),
  text: z.string().trim().min(1),
});

// string | HowToStep → { "@type": "HowToStep", text }
const instruction = z
  .union([z.string().trim().min(1), howToStep])
  .transform((v) => ({
    "@type": "HowToStep" as const,
    text: typeof v === "string" ? v : v.text,
  }));

export const recipeJsonLdSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  description: z.string().trim().min(1).optional(),
  image: z.url().optional(),
  recipeYield: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .optional(),
  prepTime: duration.optional(),
  cookTime: duration.optional(),
  totalTime: duration.optional(),
  recipeIngredient: z
    .array(z.string().trim().min(1))
    .min(1, "at least one ingredient is required"),
  recipeInstructions: z.array(instruction).optional().default([]),
  recipeCategory: stringList.optional(),
  recipeCuisine: stringList.optional(),
  keywords: stringList.optional(),
  notes: z.string().trim().min(1).optional(),
});

/** The canonical stored/served recipe document (schema.org/Recipe subset). */
export type RecipeJsonLd = z.infer<typeof recipeJsonLdSchema>;

/** Write body: the recipe document plus an optional `visibility`. */
export const recipeWriteSchema = recipeJsonLdSchema.extend({
  visibility: z.enum(["public", "draft"]).optional(),
});
export type RecipeWriteInput = z.infer<typeof recipeWriteSchema>;

/** A single normalized method step. */
export type HowToStep = RecipeJsonLd["recipeInstructions"][number];

/**
 * Derive the flat `tags` list (denormalized onto the row, never trusted from
 * the client): union of category + cuisine + keywords, lowercased and deduped.
 */
export function deriveTags(doc: RecipeJsonLd): string[] {
  const source = [
    ...(doc.recipeCategory ?? []),
    ...(doc.recipeCuisine ?? []),
    ...(doc.keywords ?? []),
  ];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of source) {
    const tag = raw.trim().toLowerCase();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

/** Wrap the stored document as a full JSON-LD object for `<script>` emission. */
export function toJsonLd(doc: RecipeJsonLd, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    ...doc,
    url,
  };
}
