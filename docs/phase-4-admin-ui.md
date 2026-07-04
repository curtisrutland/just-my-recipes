# Phase 4 — Admin UI (owner-only)

Status: **SHIPPED & deployed (2026-07-04).** As-built code lives in `src/app/admin/`,
`src/lib/admin/`, and `src/proxy.ts`. This doc is the original spec, kept as a record; the
§8 OPEN items are now resolved (see §8) and a few as-built refinements are noted there.

An owner-only, in-browser admin surface at `/admin` for the things the public site and the
Skill can't do comfortably from a phone: **see drafts, author and edit recipes in a form,
publish/unpublish, and hard-delete drafts.** No public UI changes in this phase.

---

## 1. Scope boundary

**In:**
- Browser-facing auth gate on `/admin` (first user-facing auth in the app).
- Dashboard listing **all** recipes including drafts (the public site never shows drafts).
- In-browser authoring (create) and editing (update) via a full-schema form.
- Publish / unpublish (visibility toggle).
- Hard-delete — **drafts only** (see §5).

**Out (future phases / not now):**
- Any public-facing UI/UX enhancement (search results page, tag polish, etc.).
- Image upload / media hosting — the `image` field stays a URL, as today.
- Multi-user / roles — single owner only.
- Slug editing — slugs remain immutable (data layer already enforces this).
- Bulk operations, revision history, soft-delete/trash.

---

## 2. Locked decisions (from scoping)

1. **Auth = Clerk**, reusing the existing `CLERK_ALLOWED_USER_ID` allowlist. It's already a
   dependency and gives real session management. It is the Clerk **dev** instance — acceptable
   for a single owner (same instance the parked MCP connector uses).
2. **Writes = Server Actions calling the data layer directly** (`createRecipe` /
   `updateRecipe` / `deleteRecipe` + `revalidateForRecipe`). **No API key in the browser.**
   The REST API (`/api/recipes`, token auth) is untouched and remains the path for the Skill.
3. **Delete safety = unpublish-first.** A live recipe can only be *unpublished*; hard-delete is
   available **only from the drafts view**. Full destruction is always two deliberate steps.

---

## 3. Auth model (4.0)

Today Clerk is **server-side / MCP-only**: no `ClerkProvider`, no sign-in UI, and `proxy.ts`
scopes `clerkMiddleware()` to exactly the MCP + `.well-known/oauth-*` paths so a Clerk problem
can't take down the public site. Phase 4 preserves that isolation:

- **`ClerkProvider` scoped to the `/admin` segment only** (in `src/app/admin/layout.tsx`), not
  the root layout. The public site continues to render with zero Clerk in its tree.
- **Extend the `proxy.ts` matcher** to include `/admin(.*)` (and the Clerk sign-in callback
  path). The matcher stays an explicit allowlist — the public site + `/api/recipes` still never
  touch Clerk. A Clerk outage degrades `/admin` only.
- **Defense in depth:** a shared `requireOwner()` server helper calls `auth()` and asserts the
  user id equals `CLERK_ALLOWED_USER_ID`. Every admin page **and** every server action calls it
  independently — the middleware redirect is a convenience, not the security boundary. A
  non-owner (or signed-out) request to any admin route or action is rejected server-side.
- **Sign-in:** Clerk-hosted sign-in on the dev instance (redirect), gating `/admin`. Signing in
  as any Clerk user who is *not* the allowlisted owner still gets bounced by `requireOwner()`.

**Acceptance:** signed-out `/admin` → sign-in; signed-in non-owner → 404/forbidden; owner →
admin shell. Public routes render identically to before (no Clerk in their request path).

---

## 4. Routes

| Route | Purpose | Rendering |
|---|---|---|
| `/admin` | Dashboard: Published + Drafts sections | Dynamic, per-request, **uncached** (reads drafts) |
| `/admin/new` | Authoring form (create) | Dynamic |
| `/admin/[slug]/edit` | Editing form (update) | Dynamic |

Admin reads must **never** be statically cached (they show drafts and are owner-gated). Under
Cache Components this means no `"use cache"` on these paths and forcing dynamic via the
Next-16-sanctioned mechanism (`await connection()` — `export const dynamic` is banned here).
Verify the exact pattern against `node_modules/next/dist/docs/` at implementation time.

Data reads use the **existing uncached** query functions directly (not `src/lib/cached.ts`,
which is public-only + `cacheLife("max")`): `listRecipeRows({ includeDrafts: true, ... })`,
`countRecipes(...)`, and raw `getRecipeRow(slug)` (returns any visibility) for the edit form.

---

## 5. Dashboard + delete model (4.1)

Single dashboard, two grouped sections:

- **Published** — each row: title, tags, updated-at, **Edit**, **Unpublish** (→ draft). No
  delete control here at all.
- **Drafts** — each row: title, updated-at, **Edit**, **Publish** (→ public), **Delete**.

`Unpublish`/`Publish`/`Delete` are server actions (`updateRecipe(slug, doc, "draft"|"public")`
and `deleteRecipe(slug)`), each guarded by `requireOwner()` and followed by
`revalidateForRecipe(slug)` so the public cache and this dashboard both refresh.

**Delete confirmation:** since delete is already gated behind unpublish-first, a single explicit
confirm step on the draft row is sufficient (proposed: an inline "Delete permanently?" confirm,
not a full type-the-slug challenge). Marked OPEN in §8 in case you want stronger friction.

**Acceptance:** publishing/unpublishing moves a recipe between sections and updates the public
site; the public site and its `/recipes/[slug]` page reflect the new visibility on next load;
delete removes a draft permanently and 404s its public URL; delete is unreachable for any
published recipe.

---

## 6. Authoring / editing form (4.2)

One form component backs both `/admin/new` (empty) and `/admin/[slug]/edit` (prefilled from
`getRecipeRow`). Submits to a server action that re-validates with **`recipeWriteSchema`** (the
same Zod schema the API uses — single source of truth) and returns field-level errors on
failure (`useActionState`-style). Client-side validation mirrors it for fast feedback but the
server validation is authoritative.

**Fields (full `recipeWriteSchema`):**
- `name` (required), `description`, `image` (URL).
- `recipeYield` (free text).
- `prepTime` / `cookTime` / `totalTime` — stored as ISO 8601 durations. **Input UX is OPEN**
  (§8): proposed friendly minutes/hours numeric inputs converted to `PT..M`, not raw ISO text.
- `recipeIngredient` (dynamic list, **≥1 required**).
- `recipeInstructions` (dynamic list; each step = `text` + optional `name` heading).
- `recipeCategory` / `recipeCuisine` / `keywords` (comma-or-list, normalized by the schema).
- `notes` (freeform).
- `nutrition` — the 8 optional numeric fields (numbers, not unit strings; the schema rejects
  `"22 g"`). Rendered on the public page by the Phase 3.3 strip once present.
- `visibility` — public/draft. New recipes default to **draft** (schema/table default).

**Slug:** on create, derived from `name` by the data layer (`uniqueSlug`), immutable thereafter.
No slug field in the form; the edit page shows the slug read-only.

**Acceptance:** creating a valid recipe writes a row (draft by default) and it appears in the
Drafts section; editing replaces the doc and revalidates the public page; invalid input shows
field errors and writes nothing; unknown fields are stripped (schema behavior).

---

## 7. Sub-phase order & deliverables

- **4.0 Auth gate** — segment-scoped `ClerkProvider`, extended `proxy.ts` matcher,
  `requireOwner()` helper, sign-in, empty `/admin` shell. *Ship + verify the gate before any
  data surface exists.*
- **4.1 Dashboard** — Published/Drafts sections, visibility toggles, draft delete (server
  actions + revalidation).
- **4.2 Authoring form** — shared create/edit form, server-action writes, dual Zod validation,
  duration UX.
- **4.3 Polish** — delete confirmation, empty/error/loading states, mobile layout, owner-only
  entry link (see §8), styling to match existing tokens (`text-ink`/`muted`/`line`/`surface`,
  `font-display`, dark mode).

Implement on a `phase-4-admin-ui` branch, consistent with prior phases; merge to `main` per
sub-phase or at the end, your call.

---

## 8. OPEN items — RESOLVED (as built)

1. **Duration input UX** → friendly hours/minutes numeric inputs, converted to ISO 8601
   (`RecipeForm.tsx` `Duration`, `src/lib/duration.ts`).
2. **Delete friction** → a two-click inline arm/confirm (4s auto-disarm) in
   `DeleteDraftButton.tsx` — the single inline confirm, not a type-the-slug challenge.
3. **Admin entry point** → a plain, always-visible `Admin` link in the site footer (public
   tree stays Clerk-free — non-owners who click it just hit sign-in).
4. **Sign-in surface** → Clerk-hosted redirect via `auth.protect()` in `proxy.ts` (least
   code); no `/admin/sign-in` route.
5. **Dashboard ordering/scale** → no pagination; `listRecipeRows({ limit: 500 })`, ordered
   `createdAt desc`. Revisit if the collection grows.

**As-built refinements vs. the spec above:**
- Publish/unpublish use a dedicated column-only `setRecipeVisibility(slug, ...)` rather than
  a full-doc `updateRecipe` — safer, can't mangle the stored document.
- The owner gate shipped as three helpers in `src/lib/admin/auth.ts`: `getOwnerUserId`,
  `requireOwner` (404s, for pages), and `assertOwner` (throws, for server actions).
- Dynamic rendering: rather than `await connection()`, the layout reads Clerk's `auth()` (a
  request API) under a `<Suspense>` boundary — that's what satisfies Cache Components here.

---

## 9. Next 16 / stack specifics to verify at implementation time

Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` before writing code:
- Forcing dynamic (uncached) rendering on `/admin` under Cache Components (`await connection()`
  vs alternatives; `export const dynamic` is banned).
- `ClerkProvider` scoped to a nested segment layout in `@clerk/nextjs` v7 + Next 16 "Proxy"
  (`clerkMiddleware` in `proxy.ts`, not `middleware.ts`).
- Server Actions + `useActionState` validation-error return shape in React 19 / Next 16.
- `revalidateForRecipe` / `cacheTag` invalidation from within a server action.
