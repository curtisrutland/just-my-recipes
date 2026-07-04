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
  // Optional short heading for the step (standard schema.org vocabulary).
  name: z.string().trim().min(1).max(120).optional(),
  text: z.string().trim().min(1),
});

// string | HowToStep → { "@type": "HowToStep", name?, text }.
// `name` is retained through normalization only when present; any other
// unknown step fields are stripped by the object parse above.
const instruction = z
  .union([z.string().trim().min(1), howToStep])
  .transform(
    (v): { "@type": "HowToStep"; name?: string; text: string } =>
      typeof v === "string"
        ? { "@type": "HowToStep", text: v }
        : v.name
          ? { "@type": "HowToStep", name: v.name, text: v.text }
          : { "@type": "HowToStep", text: v.text },
  );

// schema.org NutritionInformation subset. STORED as plain numbers (grams for the
// mass macros, kcal for calories), per serving — Curtis's use is computational.
// Unit-strings like "22 g" are rejected here; units are added only on render, by the
// JSON-LD serializer (`toJsonLd`), never stored. Everything optional; omit the whole
// key if unknown. Unknown sub-keys are stripped (Zod object default), like top-level.
const nonNegNumber = z
  .number({ message: "use a plain number (grams/kcal implied, per serving)" })
  .nonnegative();
export const nutritionSchema = z
  .object({
    calories: nonNegNumber.optional(),
    proteinContent: nonNegNumber.optional(),
    fatContent: nonNegNumber.optional(),
    carbohydrateContent: nonNegNumber.optional(),
    fiberContent: nonNegNumber.optional(),
    sugarContent: nonNegNumber.optional(),
    sodiumContent: nonNegNumber.optional(),
    saturatedFatContent: nonNegNumber.optional(),
  })
  .optional();

/** schema.org NutritionInformation gram-based keys (rendered with a "g" suffix). */
const NUTRITION_GRAM_KEYS = [
  "proteinContent",
  "fatContent",
  "carbohydrateContent",
  "fiberContent",
  "sugarContent",
  "sodiumContent",
  "saturatedFatContent",
] as const;

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
  nutrition: nutritionSchema,
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

/**
 * Render stored numeric nutrition as a schema.org `NutritionInformation` object with
 * unit strings (`31` → `"31 g"`, `420` → `"420 calories"`). JSON-LD requires strings;
 * the raw numbers must never leak into the public structured data.
 */
function nutritionToJsonLd(n: NonNullable<RecipeJsonLd["nutrition"]>) {
  const out: Record<string, string> = { "@type": "NutritionInformation" };
  if (n.calories != null) out.calories = `${n.calories} calories`;
  for (const key of NUTRITION_GRAM_KEYS) {
    const v = n[key];
    if (v != null) out[key] = `${v} g`;
  }
  return out;
}

/** Wrap the stored document as a full JSON-LD object for `<script>` emission. */
export function toJsonLd(doc: RecipeJsonLd, url: string) {
  const { nutrition, ...rest } = doc;
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    ...rest,
    ...(nutrition ? { nutrition: nutritionToJsonLd(nutrition) } : {}),
    url,
  };
}
