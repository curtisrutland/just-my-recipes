import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Offline tests for the manage-recipes Skill's `validate` command (canonical
 * tag-vocabulary checks). We shell out to the real `recipes.py` — the source
 * script with `{{placeholders}}` intact runs `validate` fine (it's offline and
 * never touches the token/API base), so this exercises exactly what ships. Kept
 * in Vitest (not a co-located Python test) so it runs in `npm test` and is never
 * bundled into the uploaded skill zip. Requires `python3` on PATH.
 */
const SCRIPT = "skills/manage-recipes/recipes.py";
const base = { name: "x", recipeIngredient: ["y"] };

let dir: string;
let seq = 0;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "skill-validate-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function runValidate(doc: unknown, opts: { patch?: boolean } = {}) {
  const file = join(dir, `f${seq++}.json`);
  writeFileSync(file, JSON.stringify(doc));
  const args = ["validate", ...(opts.patch ? ["--patch"] : []), file];
  const r = spawnSync("python3", [SCRIPT, ...args], { encoding: "utf8" });
  if (r.error) throw r.error; // e.g. python3 not installed
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/**
 * Extract the hard-fail errors map (path → messages) from stderr. Errors are
 * emitted as a `json.dumps` block, so inner quotes are escaped there — parse it
 * back to structured data rather than substring-matching the escaped text.
 * (Warnings are printed plain, so those are matched directly on stderr.)
 */
function errorsOf(stderr: string): Record<string, string[]> {
  const i = stderr.indexOf("{");
  const j = stderr.lastIndexOf("}");
  if (i === -1 || j === -1) return {};
  return JSON.parse(stderr.slice(i, j + 1));
}

describe("validate: canonical recipeCategory (hard-fail, closed set)", () => {
  it("accepts a canonical category", () => {
    const r = runValidate({ ...base, recipeCategory: ["Main Course"] });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^OK/);
  });

  it("hard-fails a non-canonical category", () => {
    const r = runValidate({ ...base, recipeCategory: ["dinner"] });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("recipeCategory");
    expect(r.stderr).toContain("not a canonical course");
  });

  it("suggests the canonical casing on a case-only mismatch", () => {
    const r = runValidate({ ...base, recipeCategory: ["Main course"] });
    expect(r.code).toBe(1);
    expect(errorsOf(r.stderr).recipeCategory.join(" ")).toContain('did you mean "Main Course"');
  });

  it("checks every element of a category array, flagging only the bad one", () => {
    expect(runValidate({ ...base, recipeCategory: ["Main Course", "Dessert"] }).code).toBe(0);
    const r = runValidate({ ...base, recipeCategory: ["Main Course", "dinner"] });
    expect(r.code).toBe(1);
    // Exactly one flagged value (dinner) — "Main Course" is canonical and not flagged.
    const msgs = errorsOf(r.stderr).recipeCategory;
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('"dinner"');
  });

  it("emits only the shape error for a wrong-type category (no stacked vocab error)", () => {
    const r = runValidate({ ...base, recipeCategory: 42 });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("must be a string or an array of strings");
    expect(r.stderr).not.toContain("canonical course");
  });
});

describe("validate: recipeCuisine (warn-only, open seed)", () => {
  it("accepts a seeded cuisine silently", () => {
    const r = runValidate({ ...base, recipeCuisine: ["Mexican"] });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^OK/);
    expect(r.stderr).not.toContain("recipeCuisine");
  });

  it("warns on an unrecognized cuisine but passes", () => {
    const r = runValidate({ ...base, recipeCuisine: ["Thai"] });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^OK/);
    expect(r.stderr).toContain("recipeCuisine");
    expect(r.stderr).toContain("not a recognized cuisine");
  });

  it("suggests casing for a cuisine near-match but still passes", () => {
    const r = runValidate({ ...base, recipeCuisine: ["tex-mex"] });
    expect(r.code).toBe(0);
    expect(r.stderr).toContain('did you mean "Tex-Mex"');
  });
});

describe("validate: vocabulary + --patch and keywords guardrails", () => {
  it("does not vocab-check an absent field under --patch", () => {
    const r = runValidate({ keywords: ["beef"] }, { patch: true });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^OK/);
  });

  it("still hard-fails a bad category under --patch (vocab checks are not relaxed)", () => {
    const r = runValidate({ recipeCategory: ["dinner"] }, { patch: true });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("not a canonical course");
  });

  it("leaves keywords untouched — fragmentation there is intentional", () => {
    const r = runValidate({ ...base, keywords: ["ground beef", "beef", "weeknight"] });
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
  });
});
