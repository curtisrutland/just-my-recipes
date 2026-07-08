# Phase 6 — Favorites

**Status:** scoped, not started. **Size:** M.

A second owner-controlled state axis on a recipe, independent of `visibility`:
**favorite**. The owner marks standout recipes; the public site can filter to
just favorites and shows a ★ badge, but can never toggle a favorite.

The whole design mirrors the existing `visibility` machinery — a first-class
column with a **column-only toggle** that never touches the JSONB document — so
favoriting can never mangle a recipe. If in doubt anywhere below, copy what
`visibility` / `setRecipeVisibility` / `publishRecipe` already do.

---

## 1. Decisions (locked with the owner)

- **Any recipe can be favorited, drafts included.** Favorite is a separate axis
  from `visibility`; it does not publish or hide. The public "favorites only"
  view is the natural intersection `visibility=public AND favorite=true`, so a
  favorited draft still never appears publicly.
- **Public surfacing = an in-browser "★ Favorites" toggle** inside the existing
  `RecipeBrowser` (not a separate `/favorites` page — a dedicated page is a
  possible later add, see §8).
- **Show a ★ badge** on public list rows and the detail page.
- **Managed two ways:** the `/admin` dashboard and the `manage-recipes` Skill.
  The public site is **read-only** with respect to favorites.

---

## 2. Data model — new column (`src/lib/db/schema.ts`)

Add to the `recipes` table, beside `visibility`:

```ts
favorite: boolean("favorite").notNull().default(false),
```

(add `boolean` to the `drizzle-orm/pg-core` import.) It is **server-managed**,
like `visibility`/`tags` — **not** part of the schema.org document
(`RecipeJsonLd`) and **not** in `recipeWriteSchema`, so it never enters the
create/update document path.

Migration: `npm run db:generate` → an additive `drizzle/000N_*.sql`
(`ALTER TABLE recipes ADD COLUMN favorite boolean NOT NULL DEFAULT false` —
non-breaking, backfills existing rows to `false`), then `npm run db:migrate`.
No index (mirrors `visibility`, unindexed at this scale).

---

## 3. Query layer (`src/lib/queries.ts`) — the single data-access module

- **`serializeRecipe(row)`** — add `favorite: row.favorite` so it surfaces in
  every REST/MCP response.
- **`setRecipeFavorite(slug, favorite): Promise<boolean>`** — an exact copy of
  `setRecipeVisibility`: updates only the `favorite` column + `updatedAt`,
  returns `false` if no such slug. Touches nothing in the JSONB `data` /
  `title` / `tags`, so a toggle can never mangle the document.
- **`ListOptions`** — add `favoritesOnly?: boolean`.
- **`recipeFilters(opts)`** — add
  `if (opts.favoritesOnly) conds.push(eq(recipes.favorite, true));`. It ANDs
  with the existing visibility/tag/q conditions, and `countRecipes` shares it, so
  the page and its count stay consistent.

---

## 4. Managed — admin (owner Clerk auth)

**Server actions (`src/app/admin/actions.ts`)** — add `favoriteRecipe(slug)` /
`unfavoriteRecipe(slug)`, copies of `publishRecipe`/`unpublishRecipe`:
`assertOwner()` → `setRecipeFavorite(slug, true|false)` →
`revalidateForRecipe(slug)` → `revalidatePath("/admin")`. The
`revalidateForRecipe` call is essential — it busts `INDEX_TAG` + the recipe tag
so the cached public listings/detail re-render the ★ badge.

**Dashboard toggle (`src/app/admin/page.tsx`)** — in the `Row` component, add a
favorite toggle **on every row** (both `draft` and `public` kinds), using the
existing `<form action={serverAction.bind(null, row.slug)}>` pattern (no client
JS). `★ Unfavorite` when `row.favorite`, else `☆ Favorite`. The DB `RecipeRow`
already carries `favorite` after §2, so no extra query.

---

## 5. Managed — Skill + REST API

**New endpoint — `src/app/api/recipes/[slug]/favorite/route.ts`**
`PUT /api/recipes/{slug}/favorite`, body `{ "favorite": true|false }`:
- `isAuthorized(request)` (accepts the publish token — a write, like
  set-visibility; deliberately **not** delete-gated), else `unauthorized()`.
- Validate body is `{ favorite: boolean }` (tiny Zod object or inline check);
  400 on bad JSON/shape.
- `setRecipeFavorite(slug, favorite)`; `notFound()` if it returns false.
- `revalidateForRecipe(slug)`; return `serializeRecipe(getRecipeRow(slug))`.

*Why a dedicated endpoint* (vs. threading `favorite` through `PUT /{slug}` the
way `visibility` is): it keeps `favorite` entirely out of `recipeWriteSchema` /
the document and avoids a full-document rewrite to flip one flag — matching the
column-only-toggle philosophy.

**Public read filter (`src/app/api/recipes/route.ts` `GET`)** — parse
`const favoritesOnly = params.get("favorites") === "1";` into `opts`. No auth
(it only narrows, and unauthed callers are already public-only).

**Skill (`skills/manage-recipes/recipes.py` + `SKILL.md`)**
- `recipes.py`: add `"favorite"` to `_MANAGED` (so `_doc()` strips it from reads
  and an `update`/`set-visibility` full-PUT never round-trips it); add
  `cmd_set_favorite` — `usage: set-favorite <slug> <on|off>`, `PUT
  …/{slug}/favorite` with `{"favorite": True|False}`, auth; print `"<slug> is
  now favorited"` / `"no longer favorited"`; register in `CMDS`. Optionally show
  `[★]` in `cmd_list`/`cmd_search` lines.
- `SKILL.md`: add the `set-favorite` row to the Operations table, a behavior
  bullet ("favorite is a separate axis from publish — it does not change
  visibility"), and list `favorite` among the server-managed fields.
- No build change: `npm run skills:build` then re-upload the zip.

`validate` needs **no change** — favorite is never in a create/update patch.

---

## 6. Public UI — toggle + badge

- **`src/lib/cached.ts`** — add `favorite: boolean` to `RecipeListItem` and set
  it in `toListItem` (`favorite: row.favorite`). Add `favorite` to
  `RecipeDetail` and return it from `getViewableRecipe`. Both are cache-tagged
  and busted by `revalidateForRecipe`, so toggles reflect after the admin/Skill
  action.
- **`src/components/RecipeBrowser.tsx`** — add `favoritesOnly` state; extend
  `ApiRecipe` + its `toListItem` with `favorite`. In `fetchPage`,
  `if (favoritesOnly) params.set("favorites", "1");`, and add `favoritesOnly` to
  the re-fetch `useEffect` deps (toggling then behaves like a tag change:
  `fetchPage(true, 0)`). Render a "★ Favorites" toggle chip styled like the
  `TagCloud` chips (near "All" or beside search).
- **`src/components/RecipeRow.tsx`** — render a small ★ by the title when
  `recipe.favorite`.
- **`src/app/recipes/[slug]/page.tsx`** — render a ★ badge when the recipe is
  favorited (reads `favorite` from `getViewableRecipe`).

---

## 7. OpenAPI (`openapi.yaml` via `scripts/build-openapi.mjs`)

Add the `favorite` field to the Recipe response schema and document
`GET /api/recipes?favorites=1` + `PUT /api/recipes/{slug}/favorite`. Run
`npm run openapi:build`.

---

## 8. MVP vs later

**MVP (this phase):** everything in §2–§7.

**Later:**
- Dedicated, shareable, statically-cached `/favorites` page mirroring
  `/tags/[tag]` (`getInitialFavoritesIndex` + a lean client list), if a
  bookmarkable URL is wanted alongside the in-browser toggle.
- A "★ Favorites" quick-filter chip on `/tags/[tag]` pages too.

---

## 9. Verification

Read `node_modules/next/dist/docs/` for any App Router API touched before coding
(this Next.js has breaking changes — see `AGENTS.md`).

1. **Migration** — `db:generate` shows only an additive `ADD COLUMN`;
   `db:migrate`; confirm via `db:studio` the column exists, default `false` on
   existing rows.
2. **Unit tests (`npm test`)** — `setRecipeFavorite` (flips column, false on
   missing slug), `recipeFilters` with `favoritesOnly` (emits `favorite = true`,
   ANDs with visibility), `serializeRecipe` (includes `favorite`). Match existing
   test locations/conventions.
3. **Admin** — toggle ★ on a draft and a published recipe; reload → persists;
   button label flips.
4. **Public filter + badge** — home "★ Favorites" toggle narrows to public
   favorited recipes, count updates, ★ shows on rows + detail; toggle off
   restores the full list.
5. **Draft-favorite isolation** — favorite a *draft*; the public toggle and
   `GET /api/recipes?favorites=1` (no auth) must **not** show it;
   `?favorites=1&include=drafts` + API key must.
6. **Public cannot write** — the toggle only issues a `GET`; favoriting needs the
   admin action or `PUT /{slug}/favorite`. Hit the endpoint without a token → 401.
7. **Skill path** — `curl -X PUT …/api/recipes/<slug>/favorite -H "Authorization:
   Bearer $RECIPES_PUBLISH_TOKEN" -d '{"favorite":true}'` → 200 + serialized
   recipe with `favorite:true`; verify in `/admin` and the public toggle.

---

## 10. Files touched (summary)

- `src/lib/db/schema.ts` + generated `drizzle/000N_*.sql`
- `src/lib/queries.ts` — `setRecipeFavorite`, `serializeRecipe`, `ListOptions`, `recipeFilters`
- `src/app/admin/actions.ts`, `src/app/admin/page.tsx`
- `src/app/api/recipes/route.ts` (+ `favorites` param); NEW `src/app/api/recipes/[slug]/favorite/route.ts`
- `skills/manage-recipes/{recipes.py,SKILL.md}`
- `src/lib/cached.ts`, `src/components/RecipeBrowser.tsx`, `src/components/RecipeRow.tsx`, `src/app/recipes/[slug]/page.tsx`
- `openapi.yaml`
