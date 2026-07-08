# Architecture

A one-page map of how justmy.recipes fits together. For the API contract see
`openapi.yaml`; for env vars see `docs/environment.md`; for deploy see `docs/deploy.md`.

**This doc exists so you don't have to rediscover the codebase.** If it can't
answer your question, prefer reading the specific module named below over a
codebase-wide search.

## Codebase map (where things live)

| Concern | Module | Notes |
|---|---|---|
| **DB access (the one place)** | `src/lib/queries.ts` | Every read/write funnels here. `recipeFilters` (shared by `listRecipeRows` + `countRecipes`), `getRecipeRow`, `createRecipe`/`updateRecipe`, column-only toggles (`setRecipeVisibility`, …), and `serializeRecipe` — **the REST/MCP response shape** (spreads server-managed `slug`/`visibility`/`tags`/timestamps over `...row.data`). |
| **Schema (validator + type)** | `src/lib/recipe.ts` | `recipeWriteSchema` / `RecipeJsonLd` — the single source of truth (see below). Also `deriveTags`, `toJsonLd`, nutrition render helpers. |
| **DB tables** | `src/lib/db/schema.ts` | Drizzle table defs; `RecipeRow`/`NewRecipeRow` types. |
| **Cached public reads** | `src/lib/cached.ts` | `"use cache"` wrappers + the `RecipeListItem`/`RecipeDetail` page-facing shapes. |
| **Cache invalidation** | `src/lib/cache-tags.ts` | `INDEX_TAG`, `recipeTag`, `revalidateForRecipe`. |
| **REST API** | `src/app/api/recipes/route.ts`, `.../[slug]/route.ts` | GET (public list/detail), POST/PUT (token), DELETE (primary key only). |
| **Admin server actions** | `src/app/admin/actions.ts` | Owner-gated writes; the admin UI never holds an API token. |
| **Admin UI** | `src/app/admin/` | `page.tsx` (dashboard rows), `RecipeForm.tsx`, `[slug]/edit`, `new`. |
| **Public UI** | `src/app/page.tsx`, `src/components/RecipeBrowser.tsx` (+ `RecipeRow`, `TagCloud`), `src/app/recipes/[slug]/page.tsx`, `src/app/tags/[tag]/` | `RecipeBrowser` is API-driven (static first page, then `/api/recipes?…`). |
| **Skill** | `skills/manage-recipes/` | Templated stdlib Python CLI (`SKILL.md` + `recipes.py`), built by `scripts/build-skills.mjs` (injects `RECIPES_PUBLISH_TOKEN` from `.env.local`) into gitignored `skills-dist/`. Talks to the **prod** REST API; create/update/set-visibility, **no delete**. |

## The column-only-toggle pattern

Owner-controlled **state axes** that must never touch the recipe document live as
**first-class columns** (not in the JSONB `data`, not in `recipeWriteSchema`),
each with a dedicated toggle that updates only that column + `updatedAt`:
`setRecipeVisibility` is the reference implementation. This guarantees a toggle
can never mangle the stored document. Copy it for any new such axis; wrap it in an
auth'd server action (admin) and/or a small dedicated endpoint (Skill/API), and
always call `revalidateForRecipe` after. (`favorite`, if built per
`docs/phase-6-favorites.md`, follows exactly this.)

## Stack

Next.js 16 (App Router, React 19, **Cache Components**) on Vercel · Tailwind v4 (tokens in
`src/app/globals.css`) · Neon Postgres via Drizzle ORM (serverless **HTTP** driver) · Zod
validation · Clerk (admin + parked MCP auth) · Vitest.

## Surfaces

| Surface | Path | Auth | Rendering |
|---|---|---|---|
| Public site | `/`, `/recipes/[slug]`, `/tags/[tag]` | none | Static / PPR (prerendered, revalidated on write) |
| REST API | `/api/recipes[...]` | two-token bearer (see below) | Dynamic route handlers |
| Admin UI | `/admin[...]` | Clerk + owner allowlist | Dynamic, owner-gated |
| MCP server | `/api/mcp`, `/api/sse`, `/.well-known/oauth-*` | Clerk OAuth | **Parked** (Anthropic bug) |
| claude.ai Skill | `skills/manage-recipes` | `RECIPES_PUBLISH_TOKEN` → REST API | Runs in claude.ai's sandbox |

## Data model (`src/lib/db/schema.ts`)

- **`recipes`** — `id`, `ownerId`→users, `slug` (unique, **immutable**, generated from name),
  `title` + `tags[]` (**denormalized** from the JSONB on write so list/tag queries never parse
  JSONB), `visibility` (`public`|`draft`, default `draft`), `data` (JSONB — the schema.org/Recipe
  subset), `createdAt`/`updatedAt`.
- **`users`** — single owner in v1 (the FK exists for a possible multi-publisher v2); created
  lazily from `OWNER_EMAIL` on first write (`ensureOwnerId`).
- Neon's HTTP driver is **non-transactional** — writes are single statements, not multi-statement
  transactions.

## The recipe document (`src/lib/recipe.ts`)

`recipeJsonLdSchema` (Zod) is the **single source of truth** — the stored `RecipeJsonLd` type is
`z.infer`'d from it, so validator and type can't drift. It:
- strips unknown fields, validates ISO-8601 durations,
- normalizes `recipeInstructions` (string | HowToStep → `HowToStep[]`) and category/cuisine/keywords
  (string | csv | array → `string[]`),
- stores `nutrition` as plain **numbers** (units added only at JSON-LD render time).

`recipeWriteSchema` = the doc + optional `visibility`. The REST API, the admin server actions, and
(offline, transcribed) the Skill's `validate` all enforce this same shape.

## Caching (Cache Components)

- **Public reads are cached** — `src/lib/cached.ts` wraps queries in `"use cache"` +
  `cacheLife("max")` + `cacheTag`. `getIndexRecipes`/`getTagRecipes`/`getAllTags` carry
  `INDEX_TAG`; `getViewableRecipe(slug)` carries `recipeTag(slug)`. Listings are **public-only**;
  the detail read returns a recipe of **either** visibility, so a draft is viewable by direct URL
  (owner preview) with a "Draft" badge + `noindex` — drafts stay out of every listing but are
  reachable if you know the slug.
- **Writes revalidate on demand** — every API write and admin action calls
  `revalidateForRecipe(slug)` (`src/lib/cache-tags.ts`), which busts `INDEX_TAG` (index + all tag
  pages) and `recipeTag(slug)` (that detail page).
- **Admin + API reads are uncached** — `src/lib/queries.ts` (`listRecipeRows`, raw `getRecipeRow`,
  `countRecipes`) is the un-cached layer used by the API and the owner-gated admin (which must see
  drafts fresh). Admin pages are dynamic: Clerk's `auth()` is a request API, read under a
  `<Suspense>` boundary — that's what opts `/admin` out of the static shell (no `export const
  dynamic`, which Cache Components bans).

## Auth

- **REST API — two static tokens** (`src/lib/auth.ts`): `isAuthorized` accepts `RECIPES_API_KEY`
  **or** `RECIPES_PUBLISH_TOKEN` (create/update, read drafts); `isPrimaryKey` accepts only the
  primary key (hard `DELETE`). SHA-256 constant-time compare.
- **Admin — Clerk** (`src/proxy.ts` + `src/lib/admin/auth.ts`): `clerkMiddleware` redirects
  unauthenticated `/admin` requests to sign-in; `requireOwner()`/`assertOwner()` then assert the
  user id equals `CLERK_ALLOWED_USER_ID` (the middleware is convenience, the allowlist is the
  boundary). `ClerkProvider` and the matcher are scoped to `/admin` + MCP only, so a Clerk problem
  can never take down the public site.
- **Admin writes** go through Clerk-gated **server actions** calling the data layer directly — no
  API token in the browser. The REST API stays for the Skill and scripts.

## Write flow (end to end)

```
client (curl / Skill / admin form)
  → REST route handler  OR  admin server action
    → requireOwner()/isAuthorized()        (auth)
    → recipeWriteSchema.safeParse(body)     (validation, one schema)
    → Drizzle insert/update/delete (Neon)   (denormalize title/tags, derive slug)
    → revalidateForRecipe(slug)             (bust INDEX_TAG + recipeTag)
  → public pages refresh within moments
```
