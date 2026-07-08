<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Read the docs before exploring

**`docs/architecture.md` is the one-page map of this codebase — read it first.**
It answers most "how does X work" questions without a codebase-wide search, so
you rarely need to fan out exploration agents to (re)discover the structure.

The docs, and when to reach for each:

| File | What it covers |
|---|---|
| `docs/architecture.md` | Stack, surfaces, data model, the recipe document + validator, Cache Components (cached vs uncached reads), auth, the end-to-end write flow, and the **codebase map** (key modules). Start here. |
| `docs/environment.md` | Every env var, grouped by surface, with where each is read. |
| `docs/deploy.md` | Deploy/runbook: Vercel, Clerk dev/prod, Skill release + token rotation, rollback. |
| `docs/enhancements.md` | Backlog of candidate work (not commitments). Promote an item to a `docs/phase-*.md` spec when picked up. |
| `docs/phase-*.md` | Scoped feature specs (e.g. `phase-6-favorites.md`). Read the relevant one before implementing that feature. |

**Orientation in three lines:** all DB access funnels through
`src/lib/queries.ts` (`serializeRecipe` is the REST/MCP response shape); the
recipe document schema + validator (single source of truth) is
`recipeWriteSchema` in `src/lib/recipe.ts`; there are two write surfaces sharing
that one validator — admin **server actions** (`src/app/admin/actions.ts`, Clerk
owner auth) and the **REST API** (`src/app/api/recipes/…`, token auth), the
latter also driving the `manage-recipes` Skill.

**Keep the docs current:** when you change the architecture (a new column, a new
surface, a new pattern), update `docs/architecture.md` in the same change so the
next agent still gets an accurate map.
