import { describe, expect, it } from "vitest";
import { dedupeSlug, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("kebab-cases a name", () => {
    expect(slugify("Brown-Butter Weeknight White Beans")).toBe(
      "brown-butter-weeknight-white-beans",
    );
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("Cacio e Pepe, Done Right!")).toBe("cacio-e-pepe-done-right");
  });

  it("removes diacritics", () => {
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  });

  it("falls back to 'recipe' when nothing is left", () => {
    expect(slugify("!!!")).toBe("recipe");
    expect(slugify("   ")).toBe("recipe");
  });

  it("caps length and trims trailing hyphens", () => {
    const s = slugify("a".repeat(200));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("dedupeSlug (collision handling)", () => {
  it("returns the base when free", () => {
    expect(dedupeSlug("toast", new Set())).toBe("toast");
  });

  it("appends -2 when the base is taken", () => {
    expect(dedupeSlug("toast", new Set(["toast"]))).toBe("toast-2");
  });

  it("finds the next free numeric suffix", () => {
    expect(dedupeSlug("toast", new Set(["toast", "toast-2", "toast-3"]))).toBe(
      "toast-4",
    );
  });
});
