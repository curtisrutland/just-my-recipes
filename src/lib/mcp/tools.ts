import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { revalidateForRecipe } from "@/lib/cache-tags";
import {
  createRecipe,
  deleteRecipe,
  getPublicTags,
  getRecipeRow,
  listRecipeRows,
  serializeRecipe,
  updateRecipe,
} from "@/lib/queries";
import { recipeWriteSchema } from "@/lib/recipe";

// MCP-facing recipe fields (flat, LLM-friendly). Kept deliberately simple —
// plain strings/arrays rather than the internal Zod unions/transforms — so the
// JSON Schema Claude sees stays clean. Everything is normalized and validated
// server-side through `recipeWriteSchema` before it ever hits the DB.
// All optional here so the shape is reusable for partial (merge) updates.
const recipeFields = {
  name: z.string().min(1).optional().describe("Recipe title"),
  description: z.string().optional(),
  image: z.string().optional().describe("Image URL"),
  recipeYield: z.string().optional().describe("Yield, e.g. '4 servings'"),
  prepTime: z.string().optional().describe("ISO 8601 duration, e.g. PT20M"),
  cookTime: z.string().optional().describe("ISO 8601 duration, e.g. PT35M"),
  totalTime: z.string().optional().describe("ISO 8601 duration, e.g. PT55M"),
  recipeIngredient: z
    .array(z.string())
    .optional()
    .describe("Ingredient lines, one per entry"),
  recipeInstructions: z
    .array(z.string())
    .optional()
    .describe("Ordered method steps, one per entry"),
  recipeCategory: z.array(z.string()).optional().describe("e.g. ['dinner']"),
  recipeCuisine: z.array(z.string()).optional().describe("e.g. ['italian']"),
  keywords: z.array(z.string()).optional(),
  notes: z.string().optional().describe("Freeform cook's notes"),
};

const visibility = z
  .enum(["public", "draft"])
  .describe("'public' shows on the site; 'draft' hides it");

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Register every recipe tool on the MCP server. */
export function registerRecipeTools(server: McpServer): void {
  server.registerTool(
    "search_recipes",
    {
      title: "List / search recipes",
      description:
        "List recipes (yours, including drafts), optionally filtered by tag. Returns summaries; call get_recipe for full details.",
      inputSchema: {
        tag: z.string().optional().describe("Filter to recipes with this tag"),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async ({ tag, limit, offset }) => {
      const rows = await listRecipeRows({
        tag,
        limit: limit ?? 50,
        offset: offset ?? 0,
        includeDrafts: true,
      });
      return ok(
        rows.map((r) => ({
          slug: r.slug,
          name: r.title,
          visibility: r.visibility,
          tags: r.tags,
        })),
      );
    },
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Get a recipe",
      description: "Get the full details of a single recipe by its slug.",
      inputSchema: { slug: z.string().describe("The recipe's slug") },
    },
    async ({ slug }) => {
      const row = await getRecipeRow(slug);
      if (!row) return fail(`No recipe found with slug "${slug}".`);
      return ok(serializeRecipe(row));
    },
  );

  server.registerTool(
    "list_tags",
    {
      title: "List tags",
      description: "List all tags used across public recipes.",
      inputSchema: {},
    },
    async () => ok(await getPublicTags()),
  );

  server.registerTool(
    "create_recipe",
    {
      title: "Create a recipe",
      description:
        "Create a new recipe. `name` and at least one `recipeIngredient` are required. Defaults to a draft unless visibility is 'public'. Returns the created recipe including its generated slug.",
      inputSchema: {
        ...recipeFields,
        name: z.string().min(1).describe("Recipe title (required)"),
        recipeIngredient: z
          .array(z.string())
          .min(1)
          .describe("Ingredient lines (at least one required)"),
        visibility: visibility.optional(),
      },
    },
    async ({ visibility: vis, ...args }) => {
      const parsed = recipeWriteSchema.safeParse(args);
      if (!parsed.success) {
        return fail(`Validation failed: ${JSON.stringify(parsed.error.flatten())}`);
      }
      const { visibility: _ignored, ...doc } = parsed.data;
      const row = await createRecipe(doc, vis ?? "draft");
      revalidateForRecipe(row.slug);
      return ok(serializeRecipe(row));
    },
  );

  server.registerTool(
    "update_recipe",
    {
      title: "Update a recipe (merge)",
      description:
        "Update a recipe by slug. Only the fields you provide change; omitted fields are preserved. Arrays (ingredients, instructions, tags) are replaced wholesale when provided. The slug is immutable and never changes, even if you change the name.",
      inputSchema: {
        slug: z.string().describe("Slug of the recipe to update"),
        ...recipeFields,
        visibility: visibility.optional(),
      },
    },
    async ({ slug, visibility: vis, ...patch }) => {
      const row = await getRecipeRow(slug);
      if (!row) return fail(`No recipe found with slug "${slug}".`);

      // Shallow-merge only the fields actually supplied onto the current doc.
      const clean = Object.fromEntries(
        Object.entries(patch).filter(([, v]) => v !== undefined),
      );
      const merged = { ...row.data, ...clean };

      const parsed = recipeWriteSchema.safeParse(merged);
      if (!parsed.success) {
        return fail(`Validation failed: ${JSON.stringify(parsed.error.flatten())}`);
      }
      const { visibility: _ignored, ...doc } = parsed.data;
      const updated = await updateRecipe(slug, doc, vis);
      if (!updated) return fail(`Update failed: "${slug}" not found.`);
      revalidateForRecipe(updated.slug);
      return ok(serializeRecipe(updated));
    },
  );

  server.registerTool(
    "set_visibility",
    {
      title: "Publish / unpublish a recipe",
      description:
        "Set a recipe's visibility. Use 'draft' to unpublish (hide from the public site) or 'public' to publish. This is the safe, reversible way to remove a recipe from the site — prefer it over delete_recipe.",
      inputSchema: { slug: z.string(), visibility },
    },
    async ({ slug, visibility: vis }) => {
      const row = await getRecipeRow(slug);
      if (!row) return fail(`No recipe found with slug "${slug}".`);
      const updated = await updateRecipe(slug, row.data, vis);
      if (!updated) return fail(`Update failed: "${slug}" not found.`);
      revalidateForRecipe(slug);
      return ok(serializeRecipe(updated));
    },
  );

  server.registerTool(
    "delete_recipe",
    {
      title: "Permanently delete a recipe",
      description:
        "PERMANENTLY delete a recipe. This cannot be undone. You must pass confirm: true. To simply hide a recipe from the site, use set_visibility with 'draft' instead.",
      inputSchema: {
        slug: z.string(),
        confirm: z
          .boolean()
          .describe("Must be explicitly true to permanently delete."),
      },
    },
    async ({ slug, confirm }) => {
      if (!confirm) {
        return fail(
          `Deletion not confirmed. Re-call with confirm: true to permanently delete "${slug}", or use set_visibility to unpublish instead.`,
        );
      }
      const deleted = await deleteRecipe(slug);
      if (!deleted) return fail(`No recipe found with slug "${slug}".`);
      revalidateForRecipe(slug);
      return ok({ deleted: true, slug });
    },
  );
}
