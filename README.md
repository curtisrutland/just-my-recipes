# Just My Recipes

A personal recipe storage and display site: **[justmy.recipes](https://justmy.recipes)**.
Public reads for anyone; owner-only writes three ways — an authenticated REST API,
an owner-only **admin UI** at `/admin` (Clerk sign-in), and a **claude.ai Skill**.
The point is to get the recipe in front of the reader fast and clean — recipe
above the fold, print as a first-class output.

## Stack

- **Next.js 16** (App Router) + React + TypeScript, deployed on **Vercel**
- **Tailwind CSS v4** — design tokens in `src/app/globals.css`
- **Neon Postgres** (Vercel Marketplace) via **Drizzle ORM** + the Neon
  serverless HTTP driver
- **Zod** validation at the API boundary
- **Clerk** — auth for the owner-only `/admin` UI (scoped to `/admin` via
  `src/proxy.ts`; the public site never touches Clerk)
- **Vitest** for API/unit tests
- **Cache Components** (`cacheComponents: true`): pages are statically
  prerendered and refreshed on writes via `revalidateTag`
- **Vercel Analytics + Speed Insights**

An MCP connector (`mcp-handler` + Clerk OAuth, at `/api/mcp`) is also built and
deployed but **parked** — claude.ai can't inject its tools (an Anthropic-side
custom-connector bug), so the **claude.ai Skill** (`skills/`) is the working path.
See `docs/mcp-oauth-phase.md`.

## Getting started

```bash
npm install

# Pull env vars from Vercel (Neon credentials + app config), or create
# .env.local by hand (see "Environment variables" below).
vercel env pull .env.local

npm run db:migrate   # apply migrations to the database
npm run db:seed      # owner user + 5 sample recipes (dev)
npm run dev          # http://localhost:3000
```

## Environment variables

| Variable               | Surface | Purpose                                                    |
| ---------------------- | ------- | ---------------------------------------------------------- |
| `DATABASE_URL`         | core    | Neon connection string (injected by the Vercel/Neon integration) |
| `NEXT_PUBLIC_SITE_URL` | core    | Canonical base URL (`https://justmy.recipes` in prod)      |
| `OWNER_EMAIL`          | core    | Owner user's email (seed script + lazy owner creation)     |
| `OWNER_NAME`           | core    | Owner user's display name                                  |
| `RECIPES_API_KEY`      | API     | Primary write key. Accepted on all writes; **required** for DELETE. |
| `RECIPES_PUBLISH_TOKEN`| API     | Separate write token for the claude.ai Skill. Accepted on create/update and reading drafts; **rejected** for DELETE. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | admin | Clerk publishable key (`/admin` sign-in + MCP). |
| `CLERK_SECRET_KEY`     | admin   | Clerk secret key (`/admin` + MCP).                         |
| `CLERK_ALLOWED_USER_ID`| admin   | The single owner's Clerk user id — the `/admin` (and MCP) allowlist. |
| `SKILLS_API_BASE`      | build   | Origin the Skill build targets (default `https://justmy.recipes`). Do **not** use `NEXT_PUBLIC_SITE_URL` (localhost in dev). Read by `scripts/build-skills.mjs`. |

## Database & migrations

Schema lives in `src/lib/db/schema.ts` (two tables: `users`, `recipes`).

```bash
npm run db:generate   # generate a migration from schema changes
npm run db:migrate    # apply migrations
npm run db:push       # push schema directly (dev shortcut)
npm run db:seed       # reset + seed sample recipes
npm run db:studio     # Drizzle Studio
```

Recipes are stored as a schema.org/Recipe subset (JSONB), including optional
per-serving numeric `nutrition` and optional `name` headings on instruction steps.
`title` and `tags` are denormalized onto the row on write so list/tag queries
never parse JSONB. Slugs are generated from the name (kebab-case, deduped with a
numeric suffix) and are immutable. Free-text search (`?q=`) is a plain
case-insensitive `ILIKE` scan over title/description/notes/ingredients; a
`tsvector` column for true full-text search remains a future nicety.

## API

REST/JSON under `/api`. The contract is documented in **`openapi.yaml`**
(OpenAPI 3.1) — the source of truth for the API. Served copies are generated from
it on `prebuild` (`npm run openapi:build`) and available at **`/openapi.json`**
and **`/openapi.yaml`**.

| Method | Path                  | Auth    | Notes                                             |
| ------ | --------------------- | ------- | ------------------------------------------------- |
| GET    | `/api/recipes`        | opt     | Public list. `?q=` (free-text), `?tag=`, `?limit=` (default 50, ≤100), `?offset=`. Returns `count` (total matches, ignoring limit/offset). `?include=drafts` with a key includes drafts. |
| GET    | `/api/recipes/{slug}` | opt     | Drafts 404 without a valid key.                   |
| POST   | `/api/recipes`        | write   | Create. Body: recipe document + optional `visibility` (default `draft`). 201. |
| PUT    | `/api/recipes/{slug}` | write   | Full replace. `visibility` updatable.             |
| DELETE | `/api/recipes/{slug}` | primary | Hard delete. 204.                                 |

**Auth legend:** `write` = either `RECIPES_API_KEY` **or** `RECIPES_PUBLISH_TOKEN`;
`primary` = `RECIPES_API_KEY` only (the publish token is **rejected** for DELETE —
unpublish via PUT `visibility: draft` instead); `opt` = optional (a key changes
results but isn't required).

Errors use `{ "error": { "code", "message", "details"? } }`. A 400 is either
`validation_error` (field-level `details`) or `invalid_json` (unparseable body);
bad/missing key is 401; unknown slug is 404.

### Publish a recipe with curl

```bash
export RECIPES_API_KEY=...            # your write key
export BASE=https://justmy.recipes    # or http://localhost:3000

# Create (draft by default). Add "visibility":"public" to publish immediately.
curl -X POST "$BASE/api/recipes" \
  -H "Authorization: Bearer $RECIPES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weeknight Green Curry",
    "description": "Fast, green, forgiving.",
    "recipeYield": "4 servings",
    "prepTime": "PT10M", "cookTime": "PT20M", "totalTime": "PT30M",
    "recipeIngredient": ["2 tbsp green curry paste", "1 can coconut milk", "..."],
    "recipeInstructions": ["Fry the paste.", "Add coconut milk and simmer.", "..."],
    "keywords": ["Weeknight", "Quick"],
    "visibility": "public"
  }'

# Publish an existing draft
curl -X PUT "$BASE/api/recipes/weeknight-green-curry" \
  -H "Authorization: Bearer $RECIPES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Weeknight Green Curry", "recipeIngredient": ["..."], "visibility": "public" }'

# Delete
curl -X DELETE "$BASE/api/recipes/weeknight-green-curry" \
  -H "Authorization: Bearer $RECIPES_API_KEY"
```

Every successful write revalidates the affected recipe page, the index, and the
tag pages (via `revalidateTag`), so static pages update within moments.

## Admin UI

An owner-only dashboard at **`/admin`** (Clerk sign-in, gated to
`CLERK_ALLOWED_USER_ID`):

- **Dashboard** — every recipe in two sections: **Drafts** (Edit / Publish /
  Delete) and **Published** (Edit / Unpublish / View). Drafts are never public.
- **Authoring/editing** — `/admin/new` and `/admin/[slug]/edit` share one form
  (all fields incl. nutrition), validated by the same Zod schema as the API, and
  write via Clerk-gated server actions (no API key in the browser).
- **Delete safety** — a live recipe can only be *unpublished*; hard delete exists
  only in the Drafts view (unpublish-first).

Clerk is scoped to `/admin` (`src/proxy.ts`), so a Clerk problem can never take
down the public site. Reach it from the footer **Admin** link. Full write-up:
`docs/phase-4-admin-ui.md`.

## claude.ai integration (Skill)

claude.ai (web + mobile) manages recipes through the **`manage-recipes` Skill**
(`skills/`), which calls the REST API from claude.ai's code-execution sandbox —
list / get / tags / search / create / update (merge) / set-visibility / validate
(**no delete**). Build and upload:

```bash
npm run skills:build   # injects RECIPES_PUBLISH_TOKEN into skills-dist/<skill>.zip
```

Upload `skills-dist/manage-recipes.zip` to claude.ai → Settings → Skills; enable
code execution + network egress and allowlist `justmy.recipes`. See
`skills/README.md`. (The MCP connector at `/api/mcp` is built but parked — blocked
by an Anthropic-side bug.)

## Testing

```bash
npm test          # run once
npm run test:watch
```

Vitest covers the API route handlers (auth, Zod validation, visibility
filtering, each endpoint's success + error paths) and the pure helpers (slug
generation + collision handling, duration formatting, tag derivation). **The DB
layer is mocked** (`vi.mock("@/lib/queries")`) so tests are fast and need no
database connection.

## Deployment

Hosted on Vercel; production auto-deploys on push to `main`. Set the environment
variables above (Neon vars are injected by the integration) — at minimum
`RECIPES_API_KEY`, `RECIPES_PUBLISH_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `OWNER_EMAIL`,
`OWNER_NAME`, and the three `CLERK_*` vars (for `/admin` and MCP). Configure
`justmy.recipes` as the custom domain. `next build` prerenders the index, recipe,
and tag pages; writes revalidate them on-demand. The `/admin` routes render
dynamically (owner-gated).

## Project structure

```
src/
  proxy.ts                       Clerk middleware, scoped to /admin + MCP only
  app/
    page.tsx                     index (list + live search + tag filter)
    recipes/[slug]/page.tsx      recipe detail (+ nutrition, print, JSON-LD)
    tags/[tag]/page.tsx          tag view
    not-found.tsx                404
    admin/                       owner-only UI: dashboard, new, [slug]/edit,
                                 actions (server actions), layout (ClerkProvider)
    api/recipes/route.ts         GET list, POST create
    api/recipes/[slug]/route.ts  GET one, PUT replace, DELETE
    api/[transport]/route.ts     MCP server (built, parked)
    .well-known/oauth-*          MCP OAuth metadata (parked)
  components/                    header, footer, wake lock, ingredients, ...
  lib/
    recipe.ts                    Zod schema → RecipeJsonLd (single source)
    duration.ts                  ISO 8601 ↔ hours/minutes (admin form)
    db/schema.ts                 Drizzle schema
    queries.ts                   DB access (API + build-time)
    cached.ts                    `use cache` page reads (tagged)
    cache-tags.ts                revalidation
    admin/                       requireOwner() gate + form model
    mcp/                         MCP auth + tools (parked)
    auth.ts  errors.ts  slug.ts  format.ts  tags.ts
  lib/db/seed.ts                 dev seed
skills/                          claude.ai Skill (manage-recipes) + build templates
docs/                            phase specs (MCP, admin UI)
scripts/                         openapi + skills build
openapi.yaml                     API contract (OpenAPI 3.1)
```
