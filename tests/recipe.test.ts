import { describe, expect, it } from "vitest";
import { formatDuration } from "@/lib/format";
import { deriveTags, recipeJsonLdSchema, toJsonLd } from "@/lib/recipe";
import { displayTags, hashtag, tagHref } from "@/lib/tags";

const minimal = { name: "Toast", recipeIngredient: ["bread"] };

describe("recipeJsonLdSchema", () => {
  it("accepts a minimal valid recipe", () => {
    expect(recipeJsonLdSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects a missing name", () => {
    expect(
      recipeJsonLdSchema.safeParse({ recipeIngredient: ["x"] }).success,
    ).toBe(false);
  });

  it("rejects an empty ingredient list", () => {
    expect(
      recipeJsonLdSchema.safeParse({ name: "x", recipeIngredient: [] }).success,
    ).toBe(false);
  });

  it("strips unknown fields", () => {
    const r = recipeJsonLdSchema.parse({ ...minimal, bogus: 1, evil: "x" });
    expect(r).not.toHaveProperty("bogus");
    expect(r).not.toHaveProperty("evil");
  });

  it("normalizes string | HowToStep instructions to HowToStep[]", () => {
    const r = recipeJsonLdSchema.parse({
      ...minimal,
      recipeInstructions: [
        "Do a thing",
        { "@type": "HowToStep", text: "Do another" },
      ],
    });
    expect(r.recipeInstructions).toEqual([
      { "@type": "HowToStep", text: "Do a thing" },
      { "@type": "HowToStep", text: "Do another" },
    ]);
  });

  it("defaults instructions to an empty array", () => {
    expect(recipeJsonLdSchema.parse(minimal).recipeInstructions).toEqual([]);
  });

  it("normalizes keywords/category/cuisine (string, comma list, or array) to arrays", () => {
    const r = recipeJsonLdSchema.parse({
      ...minimal,
      keywords: "Quick, Vegan ,  Cheap",
      recipeCategory: "Dinner",
      recipeCuisine: ["Italian"],
    });
    expect(r.keywords).toEqual(["Quick", "Vegan", "Cheap"]);
    expect(r.recipeCategory).toEqual(["Dinner"]);
    expect(r.recipeCuisine).toEqual(["Italian"]);
  });

  it("validates ISO 8601 durations", () => {
    expect(recipeJsonLdSchema.safeParse({ ...minimal, totalTime: "PT35M" }).success).toBe(true);
    expect(recipeJsonLdSchema.safeParse({ ...minimal, totalTime: "PT1H30M" }).success).toBe(true);
    expect(recipeJsonLdSchema.safeParse({ ...minimal, totalTime: "35 minutes" }).success).toBe(false);
    expect(recipeJsonLdSchema.safeParse({ ...minimal, totalTime: "banana" }).success).toBe(false);
  });

  it("requires image to be a URL", () => {
    expect(recipeJsonLdSchema.safeParse({ ...minimal, image: "not a url" }).success).toBe(false);
    expect(recipeJsonLdSchema.safeParse({ ...minimal, image: "https://ex.com/a.jpg" }).success).toBe(true);
  });

  it("coerces numeric recipeYield to a string", () => {
    expect(recipeJsonLdSchema.parse({ ...minimal, recipeYield: 4 }).recipeYield).toBe("4");
  });
});

describe("HowToStep name", () => {
  it("retains name on a named step", () => {
    const r = recipeJsonLdSchema.parse({
      ...minimal,
      recipeInstructions: [
        { "@type": "HowToStep", name: "Fry the paste", text: "Push it aside." },
      ],
    });
    expect(r.recipeInstructions[0]).toEqual({
      "@type": "HowToStep",
      name: "Fry the paste",
      text: "Push it aside.",
    });
  });

  it("leaves plain-string and unnamed object steps without a name", () => {
    const r = recipeJsonLdSchema.parse({
      ...minimal,
      recipeInstructions: ["Just do it", { "@type": "HowToStep", text: "And this" }],
    });
    expect(r.recipeInstructions[0]).not.toHaveProperty("name");
    expect(r.recipeInstructions[1]).not.toHaveProperty("name");
  });

  it("allows mixed named and unnamed steps in one recipe", () => {
    const r = recipeJsonLdSchema.parse({
      ...minimal,
      recipeInstructions: [{ name: "Prep", text: "Chop." }, "Cook it."],
    });
    expect(r.recipeInstructions[0].name).toBe("Prep");
    expect(r.recipeInstructions[1]).not.toHaveProperty("name");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(
      recipeJsonLdSchema.safeParse({
        ...minimal,
        recipeInstructions: [{ name: "", text: "x" }],
      }).success,
    ).toBe(false);
    expect(
      recipeJsonLdSchema.safeParse({
        ...minimal,
        recipeInstructions: [{ name: "   ", text: "x" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a name over 120 chars", () => {
    expect(
      recipeJsonLdSchema.safeParse({
        ...minimal,
        recipeInstructions: [{ name: "a".repeat(121), text: "x" }],
      }).success,
    ).toBe(false);
  });

  it("still strips unknown step fields other than name", () => {
    const r = recipeJsonLdSchema.parse({
      ...minimal,
      recipeInstructions: [{ name: "Prep", text: "x", bogus: 1, image: "y" }],
    });
    expect(r.recipeInstructions[0]).toEqual({
      "@type": "HowToStep",
      name: "Prep",
      text: "x",
    });
  });
});

describe("deriveTags", () => {
  it("unions category + cuisine + keywords, lowercased and deduped", () => {
    const doc = recipeJsonLdSchema.parse({
      ...minimal,
      recipeCategory: ["Dinner"],
      recipeCuisine: ["Italian"],
      keywords: ["Quick", "dinner", "ITALIAN"],
    });
    expect(deriveTags(doc)).toEqual(["dinner", "italian", "quick"]);
  });
});

describe("toJsonLd", () => {
  it("wraps with @context/@type and url", () => {
    const doc = recipeJsonLdSchema.parse(minimal);
    const ld = toJsonLd(doc, "https://justmy.recipes/recipes/toast");
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Recipe");
    expect(ld.url).toBe("https://justmy.recipes/recipes/toast");
    expect(ld.name).toBe("Toast");
  });
});

describe("nutrition", () => {
  it("accepts numeric macros and preserves them", () => {
    const r = recipeJsonLdSchema.parse({
      ...minimal,
      nutrition: { calories: 420, proteinContent: 31 },
    });
    expect(r.nutrition).toEqual({ calories: 420, proteinContent: 31 });
  });

  it("rejects a unit-string value like '22 g'", () => {
    expect(
      recipeJsonLdSchema.safeParse({ ...minimal, nutrition: { proteinContent: "22 g" } }).success,
    ).toBe(false);
  });

  it("rejects a negative value", () => {
    expect(
      recipeJsonLdSchema.safeParse({ ...minimal, nutrition: { calories: -5 } }).success,
    ).toBe(false);
  });

  it("strips unknown nutrition sub-keys", () => {
    const r = recipeJsonLdSchema.parse({
      ...minimal,
      nutrition: { proteinContent: 31, protein: 99 },
    });
    expect(r.nutrition).toEqual({ proteinContent: 31 });
  });

  it("is optional (absent by default)", () => {
    expect(recipeJsonLdSchema.parse(minimal)).not.toHaveProperty("nutrition");
  });

  it("renders as schema.org NutritionInformation strings in JSON-LD", () => {
    const doc = recipeJsonLdSchema.parse({
      ...minimal,
      nutrition: { calories: 420, proteinContent: 31, fatContent: 22 },
    });
    const ld = toJsonLd(doc, "https://justmy.recipes/recipes/x");
    expect(ld.nutrition).toEqual({
      "@type": "NutritionInformation",
      calories: "420 calories",
      proteinContent: "31 g",
      fatContent: "22 g",
    });
  });

  it("omits nutrition from JSON-LD when absent", () => {
    const ld = toJsonLd(recipeJsonLdSchema.parse(minimal), "https://justmy.recipes/recipes/x");
    expect(ld).not.toHaveProperty("nutrition");
  });
});

describe("display helpers", () => {
  it("displayTags preserves case and dedupes case-insensitively", () => {
    const doc = recipeJsonLdSchema.parse({
      ...minimal,
      keywords: ["One-Pan", "one-pan", "Vegan"],
    });
    expect(displayTags(doc)).toEqual(["One-Pan", "Vegan"]);
  });

  it("hashtag strips non-alphanumerics", () => {
    expect(hashtag("One-Pan")).toBe("#onepan");
  });

  it("tagHref lowercases", () => {
    expect(tagHref("One-Pan")).toBe("/tags/one-pan");
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration("PT35M")).toBe("35 min");
    expect(formatDuration("PT6H")).toBe("6 hr");
    expect(formatDuration("PT1H30M")).toBe("1 hr 30 min");
    expect(formatDuration("P1D")).toBe("24 hr");
  });

  it("returns undefined for absent/invalid input", () => {
    expect(formatDuration(undefined)).toBeUndefined();
    expect(formatDuration("banana")).toBeUndefined();
  });
});
