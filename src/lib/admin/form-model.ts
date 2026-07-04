import type { RecipeJsonLd } from "@/lib/recipe";
import { hmToIso, isoToHM } from "@/lib/duration";

/** One method step in the form (empty `name` = no heading). */
export type StepValue = { name: string; text: string };

/** A single validation problem, keyed by dotted schema path ("" = form-level). */
export type FieldIssue = { path: string; message: string };

/** Return value of the create/update server actions (success path redirects). */
export type SaveState = { ok: boolean; errors?: FieldIssue[] };

/** The 8 nutrition inputs, in display order, with labels + units for the grid. */
export const NUTRITION_FIELDS = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinContent", label: "Protein", unit: "g" },
  { key: "fatContent", label: "Fat", unit: "g" },
  { key: "carbohydrateContent", label: "Carbs", unit: "g" },
  { key: "fiberContent", label: "Fiber", unit: "g" },
  { key: "sugarContent", label: "Sugar", unit: "g" },
  { key: "sodiumContent", label: "Sodium", unit: "g" },
  { key: "saturatedFatContent", label: "Sat Fat", unit: "g" },
] as const;

export type NutritionKey = (typeof NUTRITION_FIELDS)[number]["key"];

/**
 * All form state as strings (+ the instructions list), so every input is a plain
 * controlled field. Durations are split into hours/minutes; tag groups are raw
 * comma strings (the schema splits them); nutrition values are string inputs.
 */
export type FormValues = {
  name: string;
  description: string;
  image: string;
  recipeYield: string;
  prepH: string;
  prepM: string;
  cookH: string;
  cookM: string;
  totalH: string;
  totalM: string;
  ingredients: string; // textarea, one ingredient per line
  instructions: StepValue[];
  recipeCategory: string;
  recipeCuisine: string;
  keywords: string;
  notes: string;
  nutrition: Record<NutritionKey, string>;
  visibility: "public" | "draft";
};

function emptyNutrition(): Record<NutritionKey, string> {
  return Object.fromEntries(NUTRITION_FIELDS.map((f) => [f.key, ""])) as Record<
    NutritionKey,
    string
  >;
}

/** Blank form for `/admin/new` — a new recipe defaults to draft. */
export function emptyFormValues(): FormValues {
  return {
    name: "",
    description: "",
    image: "",
    recipeYield: "",
    prepH: "",
    prepM: "",
    cookH: "",
    cookM: "",
    totalH: "",
    totalM: "",
    ingredients: "",
    instructions: [],
    recipeCategory: "",
    recipeCuisine: "",
    keywords: "",
    notes: "",
    nutrition: emptyNutrition(),
    visibility: "draft",
  };
}

const hm = (iso?: string) => {
  const { h, m } = isoToHM(iso);
  return { h: h ? String(h) : "", m: m ? String(m) : "" };
};

/** Prefill the form from a stored recipe (for `/admin/[slug]/edit`). */
export function rowToFormValues(
  data: RecipeJsonLd,
  visibility: "public" | "draft",
): FormValues {
  const prep = hm(data.prepTime);
  const cook = hm(data.cookTime);
  const total = hm(data.totalTime);
  const nutrition = emptyNutrition();
  if (data.nutrition) {
    for (const f of NUTRITION_FIELDS) {
      const v = data.nutrition[f.key];
      if (v != null) nutrition[f.key] = String(v);
    }
  }
  return {
    name: data.name,
    description: data.description ?? "",
    image: data.image ?? "",
    recipeYield: data.recipeYield ?? "",
    prepH: prep.h,
    prepM: prep.m,
    cookH: cook.h,
    cookM: cook.m,
    totalH: total.h,
    totalM: total.m,
    ingredients: data.recipeIngredient.join("\n"),
    instructions: data.recipeInstructions.map((s) => ({
      name: s.name ?? "",
      text: s.text,
    })),
    recipeCategory: (data.recipeCategory ?? []).join(", "),
    recipeCuisine: (data.recipeCuisine ?? []).join(", "),
    keywords: (data.keywords ?? []).join(", "),
    notes: data.notes ?? "",
    nutrition,
    visibility,
  };
}

const orUndef = (s: string) => {
  const t = s.trim();
  return t === "" ? undefined : t;
};

/**
 * Form values → a plain object shaped for `recipeWriteSchema` (the same validator
 * the REST API uses). Empty fields are omitted; tag groups stay comma strings
 * (the schema normalizes them); nutrition collapses to `undefined` when blank.
 * This is intentionally NOT the validator — the server re-parses the result so
 * client and server agree on one schema.
 */
export function formValuesToPayload(v: FormValues): Record<string, unknown> {
  const nutrition: Record<string, number> = {};
  for (const f of NUTRITION_FIELDS) {
    const raw = v.nutrition[f.key]?.trim();
    if (raw) nutrition[f.key] = Number(raw);
  }
  return {
    name: v.name.trim(),
    description: orUndef(v.description),
    image: orUndef(v.image),
    recipeYield: orUndef(v.recipeYield),
    prepTime: hmToIso(Number(v.prepH), Number(v.prepM)),
    cookTime: hmToIso(Number(v.cookH), Number(v.cookM)),
    totalTime: hmToIso(Number(v.totalH), Number(v.totalM)),
    recipeIngredient: v.ingredients
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    recipeInstructions: v.instructions
      .map((s) => ({ name: orUndef(s.name), text: s.text.trim() }))
      .filter((s) => s.text),
    recipeCategory: orUndef(v.recipeCategory),
    recipeCuisine: orUndef(v.recipeCuisine),
    keywords: orUndef(v.keywords),
    notes: orUndef(v.notes),
    nutrition: Object.keys(nutrition).length ? nutrition : undefined,
    visibility: v.visibility,
  };
}
