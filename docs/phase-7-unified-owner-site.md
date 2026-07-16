# Phase 7 — Unified owner site (no separate `/admin`)

**Status:** scoped, not started. **Size:** L.

Collapse the main-site / `/admin` split. Instead of a separate admin surface,
the owner **logs in on the main site**; when signed in as the owner, owner-only
affordances (drafts in listings, edit / visibility / **Send to panel** controls
on recipe pages) light up **inline** on the public pages. Everyone else sees the
site exactly as they do today.

This is the container the "Send to panel" button eventually lives in — that
button ships **now in `/admin`** (done, see §7) and migrates here.

---

## 1. Decision (locked with the owner)

- **Approach A — server-side dynamic holes.** Owner affordances are rendered by
  **`<Suspense>` boundaries that read Clerk `auth()` at request time** (dynamic,
  uncached) and render owner controls only when the signed-in user is the owner.
  For anonymous visitors each hole resolves to nothing. This is the canonical
  Cache Components / PPR shape: one shared **static, cached shell** + per-viewer
  **dynamic holes** streamed in.
- Rejected alternative (B): a client-side Clerk island deciding visibility. A is
  chosen for correctness — visibility and enforcement live in one place
  (server), no owner markup ships to non-owners, and no post-hydration "pop-in."

---

## 2. The load-bearing invariant (do not break)

> **The cached public shell stays 100% auth-free.** Every owner-aware thing
> lives in a dynamic Suspense hole (or a dedicated owner-only read) that **fails
> closed to "render nothing."**

Two forces make this non-negotiable:

1. **Framework guardrail.** You **cannot call `auth()` inside a `"use cache"`
   function** — it reads cookies, which `use cache` forbids
   (`docs/architecture.md` caching section; the Cache Components rule). So owner
   state *cannot* be baked into the cached reads (`getIndexRecipes`,
   `getViewableRecipe`) even by accident.
2. **Outage isolation (today's property, `src/proxy.ts`).** A Clerk misconfig or
   outage may break owner controls but **must never take down the public site.**
   Because the cached shell is prerendered and served without Clerk in its path,
   a failing owner hole only blanks the owner controls. **Wrap each owner hole in
   an error boundary that renders nothing on failure** so this holds even when
   Clerk throws.

---

## 3. What moves where

| Capability (today in `/admin`) | New home | Notes |
|---|---|---|
| Draft **viewing** on the detail page | **Already works** | `getViewableRecipe` returns drafts by direct URL with `noindex` + Draft badge. No change. |
| Edit / publish-unpublish / delete-draft / **Send to panel** on a recipe | Dynamic owner hole on `/recipes/[slug]` | Controls stream in for the owner; the recipe content is the cached shell. |
| Drafts appearing **in the listing** | Separate owner-only **dynamic** section (see §5) | This is *data*, not chrome — handle carefully. |
| "New recipe" + the create/edit **forms** | Stay as owner-gated routes | The forms can remain dynamic Clerk routes (e.g. `/recipes/new`, `/recipes/[slug]/edit`, or keep them under `/admin`); only the *entry points* move inline. Deciding whether to relocate the form routes is part of implementation, not required for the model to work. |
| `/admin` dashboard (rows, pagination) | Dissolves | Its functions surface inline; the dashboard as a page goes away once the inline affordances cover them. |

---

## 4. Detail page — `/recipes/[slug]` (the easy one)

- Keep the cached shell exactly as-is (`getViewableRecipe`, `toJsonLd`, etc.).
- Add one `<Suspense>` hole rendering an `<OwnerControls slug={slug} />` server
  component that: `getOwnerUserId()` → if not owner, return `null`; if owner,
  render Edit / visibility toggle / **Send to panel** / draft-status affordances
  (reusing the existing server actions in `src/app/admin/actions.ts`).
- Draft viewing + Draft badge + `noindex` already exist; leave them.

## 5. Index + tag pages — the subtle one

Drafts in the listing is **data, not chrome**, so it can't be merged into the
shared public cache.

- **Cached public list stays public-only** (`getIndexRecipes` / `getTagRecipes`
  unchanged — shared, fast, no auth).
- The owner gets an **additional dynamic section** (a `<Suspense>` hole) that
  reads drafts via an **uncached** owner query (`listRecipeRows` already exists
  and is the uncached layer). Render it as a distinct "Drafts" strip above/below
  the public list, or merge in the client — but the **cached list is never
  polluted with per-viewer draft rows.**
- Same error-boundary-to-nothing rule as §2.

## 6. Clerk scope change (the main risk)

For `auth()` to resolve inside owner holes on public routes — and for **server
actions invoked from public pages** to authenticate — `clerkMiddleware`'s
matcher in `src/proxy.ts` must broaden beyond `/admin` + MCP to cover the public
routes (and the action endpoints).

**Verify before building the rest** (Approach A's mechanics under this repo's
`cacheComponents`):

1. `auth()` inside a `<Suspense>` hole coexists with a **cached shell** on the
   same route (the hole is dynamic; the shell stays prerendered).
2. A **server action POST from a public page** authenticates correctly with the
   broadened matcher (Clerk context present for the action request).
3. Broadening the matcher does **not** put Clerk in the critical path of the
   **cached** anonymous response (only the dynamic hole depends on it).

Prototype these three on one route (e.g. `/recipes/[slug]`) before fanning out.
`ClerkProvider` scope + the `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` surface may also
need to widen to the root layout — confirm during the prototype.

## 7. Sequencing

1. **Now — Send to panel in `/admin` (done).** `sendToPanel` server action +
   `SendToPanelButton` on the dashboard rows. In-idiom, zero risk, unblocks the
   panel task without waiting on this phase. See `src/app/admin/actions.ts`
   (`sendToPanel`) and `docs/panel-recipes-sender-brief.md`.
2. **Prototype §6** on the detail page — prove the three mechanics.
3. **Detail-page owner hole** (§4) — includes migrating the panel button here.
4. **Index/tag owner drafts section** (§5).
5. **Retire `/admin`** once inline affordances cover its functions; decide the
   fate of the form routes (§3).

## 8. Out of scope / watch

- No change to the REST API, the Skill, or MCP — this is a UI/auth-surface
  reshaping only.
- Keep the **column-only-toggle** discipline for visibility/favorite — inline
  toggles still call the dedicated column setters, never the document path.
- Don't regress the outage-isolation property: if this can't be met with an
  acceptable blast radius, stop and reconsider B for the visibility check.
