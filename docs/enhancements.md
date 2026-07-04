# Enhancements backlog

A living list of candidate enhancements for justmy.recipes — **not commitments**, just
captured ideas so nothing is lost between sessions. Each entry notes where it came from and a
rough size. Promote an item to a phase spec (`docs/phase-*.md`) when it's picked up.

Status key: `idea` (captured, unscoped) · `scoped` (has a plan) · `in-progress` · `done`.

---

## Docs

| Item | Notes | Size | Status |
|---|---|---|---|
| Complete env-var reference | All 10 vars grouped by surface, with required-ness + where each is read. | S | **done** → [`docs/environment.md`](environment.md) |
| Architecture doc | Surfaces, data model, Cache Components (cached vs uncached reads), `revalidateForRecipe`/cache-tag model, auth, write flow. | M | **done** → [`docs/architecture.md`](architecture.md) |
| Deploy / runbook doc | Vercel auto-deploy, provisioning, Clerk (dev/prod), Skill release + token rotation, deploy verification (incl. the stale-404 gotcha), rollback. | M | **done** → [`docs/deploy.md`](deploy.md) |

## Search

| Item | Notes | Size | Status |
|---|---|---|---|
| `unaccent` on Neon | Accent-insensitive search; needs the extension enabled on Neon. Noted in Phase 3, not enabled. | S | idea |
| Full-text search (`tsvector`) | Replace the `?q=` ILIKE scan with a generated `tsvector` column + GIN index (schema has a placeholder comment). | M | idea |
| Server-backed public search | Home search now hits the server `?q=` endpoint (debounced) instead of client-filtering the full list — `RecipeBrowser` is API-driven, results inline, `?q=` synced to the URL. Chosen: inline (not a `/search` page). | M | **done** (branch `ux/pagination-search`) |

## Recipe model & content

| Item | Notes | Size | Status |
|---|---|---|---|
| Recipe-as-ingredient cross-references | Reference one recipe as an ingredient of another — e.g. `scratch-made-chili-paste` is already an ingredient of `chili-con-carne-…`, but only as plain text today. Design surface to resolve when scoped: how a reference is stored (a linked ingredient line → target slug), rendering (ingredient links to the sub-recipe; optionally expand/inline its ingredients), authoring UX in the admin form + Skill, JSON-LD/print behavior, and handling a referenced recipe being unpublished or deleted (dangling link). | L | idea |

## Admin UI

| Item | Notes | Size | Status |
|---|---|---|---|
| Mobile dashboard layout too cramped | On mobile the `/admin` dashboard is too tight — recipe **titles and slugs are cut off**. The row (`page.tsx` `Row`) uses `truncate` on the title/slug with fixed-width action buttons hogging the width. Review the responsive layout: e.g. stack the action buttons below the title on narrow screens, and don't truncate the slug so aggressively (or drop it on mobile). | S | idea |
| Dashboard pagination | Currently unpaginated (`listRecipeRows({ limit: 500 })`). Fine now; revisit as the collection grows. Phase 4 §8.5. | S | idea |
| Image upload | The `image` field is URL-only today (paste a URL). Add real upload via **Vercel Blob** (`@vercel/blob` `put()`, `access: 'public'`): an admin server action uploads the file → gets a public URL → saves it into the existing `image` field, so the data model barely changes (pairs well with `next/image`). **Free-tier verdict (checked 2026, Blob pricing page):** free on Hobby within included limits — 5 GB storage, 100 GB/mo transfer, 100K simple + 10K advanced ops, shared across the project — comfortably fits a personal site (images ~100–500 KB). Hobby is **hard-capped, not billed**: exceeding a limit pauses Blob for 30 days rather than charging. | M | idea |
| Dark-mode toggle | Currently OS-preference only ("no toggle UI in v1"). | S | idea |

## Skill (manage-recipes)

| Item | Notes | Size | Status |
|---|---|---|---|
| `tags` beyond 100 recipes | `cmd_tags` caps at 100 recipes, so tags on older recipes are missed. Paginate or raise the cap. | S | idea |
| Cuisine seed expansion | Extend `_CUISINE_SEED` if warn noise grows (owner call, per the vocab spec). | XS | idea |

## Auth / infra

| Item | Notes | Size | Status |
|---|---|---|---|
| Clerk production instance | Prod currently reuses the Clerk **dev** instance. Upgrading needs DNS (Frontend-API CNAME), `pk_live`/`sk_live`, and re-creating the owner user. | M | idea |

## Integrations

| Item | Notes | Size | Status |
|---|---|---|---|
| MCP connector revival | Built + parked; blocked by an Anthropic-side claude.ai bug (both DCR and static-client paths fail). Revive if Anthropic fixes it. | — | blocked |

## Public UI/UX (the dropped Phase 4 half)

| Item | Notes | Size | Status |
|---|---|---|---|
| Public UI/UX enhancements | Explicitly dropped from Phase 4 (which narrowed to admin only). Candidate future phase — e.g. a search results page, tag browsing polish, empty states, mobile refinements. | L | idea |
| Pagination / load-more on the public lists | **Home: done** — a static first page (`PAGE_SIZE`) then "Load more" via the API (`limit`/`offset`/`count`). **Remaining:** `/tags/[tag]` still renders all recipes for a tag — give it the same "Load more" (pure pagination, no search coupling). | M | **home done** / tags pending (branch `ux/pagination-search`) |
| Share action on recipe pages | A share glyph on `/recipes/[slug]` — use the Web Share API (`navigator.share`) where available (mainly mobile), falling back to **copy-link to clipboard** on desktop (where the native share sheet is slim/absent). Sits alongside the existing print button. | S | idea |
| Viewable draft pages (unlisted preview) | Render a draft on `/recipes/[slug]` with a **"Draft" badge** + `noindex` instead of 404-ing, so the owner can preview by URL without `/admin`. Drafts stay out of listings; publish stays admin-gated. Implemented: `getPublicRecipe`→`getViewableRecipe` (returns either visibility + `visibility`), badge banner + draft `robots:noindex` on the detail page. **Decision:** the REST `GET /api/recipes/{slug}` was **left key-gated** (drafts still 404 there without a key) — only the page opened. Explicit private→unlisted trade-off (title-derived slugs are guessable). | M | **done** (branch `ux/draft-preview`) |

---

## New (uncategorized — triage into the sections above)

<!-- Add captured ideas here as they come; move them into a section with a size + status. -->
