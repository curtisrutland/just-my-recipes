# Just My Recipes

A personal recipe storage and display site: **[justmy.recipes](https://justmy.recipes)**.
Public reads for anyone, owner-only writes via an authenticated REST API. No
accounts, no admin UI, no login. The point is to get the recipe in front of the
reader fast and clean — recipe above the fold, print as a first-class output.

## Stack

- **Next.js 16** (App Router) + React + TypeScript, deployed on **Vercel**
- **Tailwind CSS v4** — design tokens in `src/app/globals.css`
- **Neon Postgres** (Vercel Marketplace) via **Drizzle ORM** + the Neon
  serverless HTTP driver
- **Zod** validation at the API boundary
- **Vitest** for API/unit tests
- **Cache Components** (`cacheComponents: true`): pages are statically
  prerendered and refreshed on writes via `revalidateTag`

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

| Variable               | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`         | Neon connection string (injected by the Vercel/Neon integration) |
| `RECIPES_API_KEY`      | Owner's write key. `Authorization: Bearer <key>` on writes |
| `NEXT_PUBLIC_SITE_URL` | Canonical base URL (`https://justmy.recipes` in prod)      |
| `OWNER_EMAIL`          | Owner user's email (seed script + lazy owner creation)     |
| `OWNER_NAME`           | Owner user's display name                                  |

## Database & migrations

Schema lives in `src/lib/db/schema.ts` (two tables: `users`, `recipes`).

```bash
npm run db:generate   # generate a migration from schema changes
npm run db:migrate    # apply migrations
npm run db:push       # push schema directly (dev shortcut)
npm run db:seed       # reset + seed sample recipes
npm run db:studio     # Drizzle Studio
```

Recipes are stored as a schema.org/Recipe subset (JSONB). `title` and `tags`
are denormalized onto the row on write so list/tag queries never parse JSONB.
Slugs are generated from the name (kebab-case, deduped with a numeric suffix)
and are immutable. Full-text search is out of scope for v1 (a `tsvector` column
would slot into the schema — see the comment there).

## API

REST/JSON under `/api`. The contract is documented in **`openapi.yaml`**
(OpenAPI 3.1) — the source of truth, and what a future MCP wrapper is generated
from.

| Method | Path                  | Auth | Notes                                             |
| ------ | --------------------- | ---- | ------------------------------------------------- |
| GET    | `/api/recipes`        | —    | Public list. `?tag=`, `?limit=` (≤100), `?offset=`. `?include=drafts` with a key includes drafts. |
| GET    | `/api/recipes/{slug}` | —    | Drafts 404 without a valid key.                   |
| POST   | `/api/recipes`        | key  | Create. Body: recipe document + optional `visibility`. 201. |
| PUT    | `/api/recipes/{slug}` | key  | Full replace. `visibility` updatable.             |
| DELETE | `/api/recipes/{slug}` | key  | Hard delete. 204.                                 |

Errors use `{ "error": { "code", "message", "details"? } }`. Validation
failures are 400 with field-level `details`; bad/missing key is 401; unknown
slug is 404.

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

Hosted on Vercel. Set `RECIPES_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `OWNER_EMAIL`,
and `OWNER_NAME` in the project's environment variables (Neon vars are injected
by the integration). Configure `justmy.recipes` as the custom domain. `next
build` prerenders the index, recipe, and tag pages; writes revalidate them
on-demand.

## Project structure

```
src/
  app/
    page.tsx                     index (list + live search + tag filter)
    recipes/[slug]/page.tsx      recipe detail (+ print, wake lock, JSON-LD)
    tags/[tag]/page.tsx          tag view
    not-found.tsx                404
    api/recipes/route.ts         GET list, POST create
    api/recipes/[slug]/route.ts  GET one, PUT replace, DELETE
  components/                    header, footer, wake lock, ingredients, ...
  lib/
    recipe.ts                    Zod schema → RecipeJsonLd (single source)
    db/schema.ts                 Drizzle schema
    queries.ts                   DB access (API + build-time)
    cached.ts                    `use cache` page reads (tagged)
    cache-tags.ts                revalidation
    auth.ts  errors.ts  slug.ts  format.ts  tags.ts
  lib/db/seed.ts                 dev seed
openapi.yaml                     API contract (OpenAPI 3.1)
```
