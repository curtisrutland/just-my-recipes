# Architecture

A one-page map of how justmy.recipes fits together. For the API contract see
`openapi.yaml`; for env vars see `docs/environment.md`; for deploy see `docs/deploy.md`.

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
