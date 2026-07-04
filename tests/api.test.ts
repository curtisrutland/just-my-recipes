import { beforeEach, describe, expect, it, vi } from "vitest";

// The route handlers are tested against a mocked DB layer (fast, no network).
vi.mock("@/lib/cache-tags", () => ({ revalidateForRecipe: vi.fn() }));
vi.mock("@/lib/queries", () => ({
  listRecipeRows: vi.fn(),
  countRecipes: vi.fn(),
  createRecipe: vi.fn(),
  getRecipeRow: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  serializeRecipe: (row: { slug: string; visibility: string; data?: object }) => ({
    slug: row.slug,
    visibility: row.visibility,
    ...(row.data ?? {}),
  }),
}));

import { revalidateForRecipe } from "@/lib/cache-tags";
import * as item from "@/app/api/recipes/[slug]/route";
import * as collection from "@/app/api/recipes/route";
import * as queries from "@/lib/queries";

const KEY = "test-key";
const auth = { authorization: `Bearer ${KEY}` };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RECIPES_API_KEY = KEY;
  vi.mocked(queries.countRecipes).mockResolvedValue(0);
});

function body(url: string, method: string, data?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}
const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const B = "http://localhost/api/recipes";

describe("GET /api/recipes", () => {
  it("lists public recipes only by default; count is total matches, not page length", async () => {
    vi.mocked(queries.listRecipeRows).mockResolvedValue([
      { slug: "a", visibility: "public", data: { name: "A" } },
    ] as never);
    vi.mocked(queries.countRecipes).mockResolvedValue(3); // total across pages
    const res = await collection.GET(new Request(B));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recipes).toHaveLength(1);
    expect(json.count).toBe(3); // from countRecipes, not rows.length
    expect(vi.mocked(queries.listRecipeRows).mock.calls[0][0]).toMatchObject({
      includeDrafts: false,
      limit: 50,
      offset: 0,
    });
  });

  it("passes q + tag through to both queries and returns count as total", async () => {
    vi.mocked(queries.listRecipeRows).mockResolvedValue([] as never);
    vi.mocked(queries.countRecipes).mockResolvedValue(42);
    const res = await collection.GET(new Request(`${B}?q=venison&tag=weeknight`));
    expect((await res.json()).count).toBe(42);
    for (const fn of [queries.listRecipeRows, queries.countRecipes]) {
      expect(vi.mocked(fn).mock.calls[0][0]).toMatchObject({ q: "venison", tag: "weeknight" });
    }
  });

  it("ignores ?include=drafts without a valid key", async () => {
    vi.mocked(queries.listRecipeRows).mockResolvedValue([] as never);
    await collection.GET(new Request(`${B}?include=drafts`));
    expect(vi.mocked(queries.listRecipeRows).mock.calls[0][0].includeDrafts).toBe(false);
  });

  it("includes drafts with ?include=drafts and a valid key", async () => {
    vi.mocked(queries.listRecipeRows).mockResolvedValue([] as never);
    await collection.GET(new Request(`${B}?include=drafts`, { headers: auth }));
    expect(vi.mocked(queries.listRecipeRows).mock.calls[0][0].includeDrafts).toBe(true);
  });

  it("clamps limit to a max of 100", async () => {
    vi.mocked(queries.listRecipeRows).mockResolvedValue([] as never);
    await collection.GET(new Request(`${B}?limit=999`));
    expect(vi.mocked(queries.listRecipeRows).mock.calls[0][0].limit).toBe(100);
  });
});

describe("POST /api/recipes", () => {
  it("401 without a key", async () => {
    const res = await collection.POST(
      body(B, "POST", { name: "x", recipeIngredient: ["y"] }),
    );
    expect(res.status).toBe(401);
  });

  it("400 with field-level details on invalid body", async () => {
    const res = await collection.POST(body(B, "POST", { description: "no name" }, auth));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("validation_error");
    expect(json.error.details).toHaveProperty("name");
  });

  it("400 invalid_json on malformed body", async () => {
    const res = await collection.POST(
      new Request(B, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: "{nope" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_json");
  });

  it("201 creates a draft by default and revalidates", async () => {
    vi.mocked(queries.createRecipe).mockResolvedValue({
      slug: "toast",
      visibility: "draft",
      data: { name: "Toast" },
    } as never);
    const res = await collection.POST(
      body(B, "POST", { name: "Toast", recipeIngredient: ["bread"] }, auth),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("location")).toBe("/api/recipes/toast");
    expect(vi.mocked(queries.createRecipe).mock.calls[0][1]).toBe("draft");
    expect(revalidateForRecipe).toHaveBeenCalledWith("toast");
  });

  it("passes a named step through to createRecipe", async () => {
    vi.mocked(queries.createRecipe).mockResolvedValue({
      slug: "s",
      visibility: "draft",
      data: { name: "S" },
    } as never);
    await collection.POST(
      body(
        B,
        "POST",
        {
          name: "S",
          recipeIngredient: ["x"],
          recipeInstructions: [{ name: "Prep", text: "Chop." }],
        },
        auth,
      ),
    );
    const doc = vi.mocked(queries.createRecipe).mock.calls[0][0];
    expect(doc.recipeInstructions[0]).toEqual({
      "@type": "HowToStep",
      name: "Prep",
      text: "Chop.",
    });
  });

  it("honors visibility:public", async () => {
    vi.mocked(queries.createRecipe).mockResolvedValue({
      slug: "toast",
      visibility: "public",
      data: { name: "Toast" },
    } as never);
    await collection.POST(
      body(B, "POST", { name: "Toast", recipeIngredient: ["bread"], visibility: "public" }, auth),
    );
    expect(vi.mocked(queries.createRecipe).mock.calls[0][1]).toBe("public");
  });
});

describe("GET /api/recipes/{slug} (visibility)", () => {
  it("404 for unknown slug", async () => {
    vi.mocked(queries.getRecipeRow).mockResolvedValue(null);
    expect((await item.GET(new Request(`${B}/x`), ctx("x"))).status).toBe(404);
  });

  it("404 for a draft without a key", async () => {
    vi.mocked(queries.getRecipeRow).mockResolvedValue({ slug: "x", visibility: "draft", data: { name: "X" } } as never);
    expect((await item.GET(new Request(`${B}/x`), ctx("x"))).status).toBe(404);
  });

  it("200 for a draft with a valid key", async () => {
    vi.mocked(queries.getRecipeRow).mockResolvedValue({ slug: "x", visibility: "draft", data: { name: "X" } } as never);
    expect((await item.GET(new Request(`${B}/x`, { headers: auth }), ctx("x"))).status).toBe(200);
  });

  it("200 for a public recipe", async () => {
    vi.mocked(queries.getRecipeRow).mockResolvedValue({ slug: "x", visibility: "public", data: { name: "X" } } as never);
    expect((await item.GET(new Request(`${B}/x`), ctx("x"))).status).toBe(200);
  });
});

describe("PUT /api/recipes/{slug}", () => {
  it("401 without a key", async () => {
    const res = await item.PUT(body(`${B}/x`, "PUT", { name: "X", recipeIngredient: ["y"] }), ctx("x"));
    expect(res.status).toBe(401);
  });

  it("404 for unknown slug", async () => {
    vi.mocked(queries.updateRecipe).mockResolvedValue(null);
    const res = await item.PUT(body(`${B}/x`, "PUT", { name: "X", recipeIngredient: ["y"] }, auth), ctx("x"));
    expect(res.status).toBe(404);
  });

  it("400 on invalid body", async () => {
    const res = await item.PUT(body(`${B}/x`, "PUT", {}, auth), ctx("x"));
    expect(res.status).toBe(400);
  });

  it("200 and revalidates on success", async () => {
    vi.mocked(queries.updateRecipe).mockResolvedValue({ slug: "x", visibility: "public", data: { name: "X" } } as never);
    const res = await item.PUT(body(`${B}/x`, "PUT", { name: "X", recipeIngredient: ["y"], visibility: "public" }, auth), ctx("x"));
    expect(res.status).toBe(200);
    expect(revalidateForRecipe).toHaveBeenCalledWith("x");
  });
});

describe("DELETE /api/recipes/{slug}", () => {
  it("401 without a key", async () => {
    const res = await item.DELETE(new Request(`${B}/x`, { method: "DELETE" }), ctx("x"));
    expect(res.status).toBe(401);
  });

  it("404 when nothing was deleted", async () => {
    vi.mocked(queries.deleteRecipe).mockResolvedValue(false);
    const res = await item.DELETE(new Request(`${B}/x`, { method: "DELETE", headers: auth }), ctx("x"));
    expect(res.status).toBe(404);
  });

  it("204 and revalidates on success", async () => {
    vi.mocked(queries.deleteRecipe).mockResolvedValue(true);
    const res = await item.DELETE(new Request(`${B}/x`, { method: "DELETE", headers: auth }), ctx("x"));
    expect(res.status).toBe(204);
    expect(revalidateForRecipe).toHaveBeenCalledWith("x");
  });
});
