import { describe, expect, it } from "vitest";
import {
  emptyFormValues,
  formValuesToPayload,
  rowToFormValues,
  type FormValues,
} from "@/lib/admin/form-model";
import { recipeJsonLdSchema, recipeWriteSchema } from "@/lib/recipe";

const filled: FormValues = {
  ...emptyFormValues(),
  name: "  Chili con Carne  ",
  description: "Scratch chili.",
  image: "https://ex.com/chili.jpg",
  recipeYield: "4 servings",
  prepH: "0",
  prepM: "20",
  cookH: "1",
  cookM: "30",
  totalH: "",
  totalM: "",
  ingredients: "2 tbsp oil\n  1 onion  \n\n3 cloves garlic\n",
  instructions: [
    { name: "Prep", text: "  Chop everything.  " },
    { name: "", text: "Simmer." },
    { name: "", text: "   " }, // dropped (blank text)
  ],
  recipeCategory: "Dinner",
  recipeCuisine: "Tex-Mex",
  keywords: "spicy, beef",
  notes: "Better next day.",
  nutrition: { ...emptyFormValues().nutrition, calories: "480", proteinContent: "34" },
  visibility: "public",
};

describe("formValuesToPayload", () => {
  it("produces a payload that validates against recipeWriteSchema", () => {
    const parsed = recipeWriteSchema.safeParse(formValuesToPayload(filled));
    expect(parsed.success).toBe(true);
  });

  it("trims, splits ingredients per line, and drops blanks", () => {
    const p = formValuesToPayload(filled);
    expect(p.name).toBe("Chili con Carne");
    expect(p.recipeIngredient).toEqual(["2 tbsp oil", "1 onion", "3 cloves garlic"]);
  });

  it("converts durations and omits empty ones", () => {
    const p = formValuesToPayload(filled);
    expect(p.prepTime).toBe("PT20M");
    expect(p.cookTime).toBe("PT1H30M");
    expect(p.totalTime).toBeUndefined();
  });

  it("keeps step names only when present and drops blank-text steps", () => {
    const p = formValuesToPayload(filled) as {
      recipeInstructions: { name?: string; text: string }[];
    };
    expect(p.recipeInstructions).toEqual([
      { name: "Prep", text: "Chop everything." },
      { name: undefined, text: "Simmer." },
    ]);
  });

  it("builds nutrition from filled numeric fields only", () => {
    const p = formValuesToPayload(filled);
    expect(p.nutrition).toEqual({ calories: 480, proteinContent: 34 });
  });

  it("omits nutrition entirely when all blank", () => {
    const p = formValuesToPayload(emptyFormValues());
    expect(p.nutrition).toBeUndefined();
  });

  it("omits empty optional text fields", () => {
    const p = formValuesToPayload({ ...emptyFormValues(), name: "X", ingredients: "a" });
    expect(p.description).toBeUndefined();
    expect(p.image).toBeUndefined();
    expect(p.notes).toBeUndefined();
  });
});

describe("rowToFormValues → formValuesToPayload round-trip", () => {
  it("preserves the normalized document through an edit round-trip", () => {
    // Start from a canonical parsed doc, load it into the form, dump it back out.
    const doc = recipeJsonLdSchema.parse({
      name: "Chili",
      description: "Hot.",
      recipeYield: "4",
      prepTime: "PT20M",
      cookTime: "PT1H30M",
      recipeIngredient: ["2 tbsp oil", "1 onion"],
      recipeInstructions: [{ name: "Prep", text: "Chop." }, "Simmer."],
      recipeCategory: ["Dinner"],
      keywords: ["spicy", "beef"],
      notes: "Better next day.",
      nutrition: { calories: 480, proteinContent: 34 },
    });
    const values = rowToFormValues(doc, "public");
    const roundTripped = recipeWriteSchema.parse(formValuesToPayload(values));
    const { visibility, ...backDoc } = roundTripped;
    expect(visibility).toBe("public");
    expect(backDoc).toEqual(doc);
  });
});
