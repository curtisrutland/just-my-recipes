# Phase 5 — Recipe-as-ingredient cross-references

**Status:** scoped, not started. **Size:** L (MVP is M).

Reference one recipe as an ingredient of another, so an ingredient line links to
the sub-recipe. Real case already in the data: `chili-con-carne-with-scratch-made-chili-paste`
lists scratch-made chili paste as plain text, and `scratch-made-chili-paste` is a
published recipe.

---

## 1. Decision: inline marker (locked)

An ingredient stays a plain string; a reference is a wiki-style marker inside the
line. `recipeIngredient` remains `string[]` — no schema-shape change, the Skill
stays string-based, and ingredient **order is preserved** (the reference sits in
the line where it belongs).

```
recipeIngredient: [
  "1 lb ground beef",
  "3 tbsp [[scratch-made-chili-paste|scratch chili paste]]",
]
```

- **Render:** `3 tbsp <a href="/recipes/scratch-made-chili-paste">scratch chili paste</a>`
- **JSON-LD / print:** `"3 tbsp scratch chili paste"` (marker flattened to its label)

Rejected alternatives: **structured ingredient objects** (`string | {text, recipeSlug}`)
— proper types but the biggest blast radius (schema union, Skill, admin editor,
Ingredients component, JSON-LD flatten); **parallel `usesRecipes` array** — loses
inline ordering and is two lists to keep in sync.

### Syntax

- `[[slug]]` — link; label is the **humanized slug**, computed purely (no DB), so
  the rendered link and the flattened JSON-LD/print text always agree. (A resolved
  DB title was rejected: `flattenIngredient` must stay pure, so it couldn't produce
  the title, and render would then disagree with structured data.)
- `[[slug|label]]` — link with an explicit label (**preferred** — the picker fills
  it from the target's title at insert time, giving a nice label with no runtime
  lookup, and keeps the string self-sufficient for flatten + graceful degrade).
- `slug` must match the slug charset `[a-z0-9-]+`; anything else leaves the `[[…]]`
  literal (no false-positive links). Multiple markers per line allowed. `[[` / `]]`
  are reserved (no escaping in the MVP).

---

## 2. Core: parse + flatten (pure, tested)

A single pure module (e.g. `lib/ingredient-refs.ts`), the seam everything else
builds on:

- `parseIngredient(line): Segment[]` where `Segment = { text } | { slug, label }`.
- `flattenIngredient(line): string` — markers → labels, for JSON-LD and any
  plain-text surface.
- `ingredientRefSlugs(doc): string[]` — all referenced slugs in a recipe (derived,
  like `deriveTags`); the basis for validation and the future reverse index.

These are stateless (no DB), so they run in the Skill's offline `validate` too.

---

## 3. Render (page + Ingredients component)

Resolution needs the DB (title + is-public), so it happens **server-side** in
`recipes/[slug]/page.tsx`, not in the client component:

1. Parse each ingredient; collect the distinct ref slugs.
2. Batch-resolve them in one query → `{ slug → { title, public } }`.
3. Build per-line render segments: a ref resolves to a link (`href`, label) when the
   target is **public**; otherwise it **degrades to plain label text** (no link) —
   a public page never shows a broken or unlisted link.
4. Pass the resolved segments to `Ingredients`, which renders text + `<a>` runs.

Component note: `Ingredients` is the client checkbox list; the whole `<li>` toggles
on click, so a ref `<a>` must `stopPropagation` (and be keyboard-reachable) so
following the link doesn't also check the ingredient off.

`toJsonLd` maps `recipeIngredient` through `flattenIngredient` so structured data
stays valid schema.org Text.

---

## 4. Dangling references

Slugs are immutable but targets can be unpublished or deleted. Handled at render by
the degrade rule in §3 (missing or non-public → plain label). No stored state, no
broken links. Draft targets count as non-public on a public page (a linked draft
would leak an unlisted URL).

---

## 5. Authoring

- **Admin form:** an "insert recipe reference" control on the ingredients field — a
  searchable picker over existing recipes that inserts `[[slug|label]]` (label
  prefilled from the title). The picker only offers real slugs, so typos are
  designed out. Ingredients stay a textarea; the picker just writes the marker.
- **Skill:** `SKILL.md` documents the syntax; offline `validate` shape-checks
  markers (balanced brackets, slug charset) and warns on a malformed one. It
  **cannot** check existence (stateless) — that's noted as a limitation.

---

## 6. Validation policy

- **Shape** (brackets, slug charset): the Zod schema / Skill `validate` — cheap,
  stateless.
- **Existence** (does the slug resolve, is it a draft): **not in the MVP.** The
  admin picker only inserts real slugs and render degrades gracefully, so the MVP
  neither hard-rejects nor warns on an unresolved ref — `SaveState` stays
  errors-only and the REST write contract is unchanged (refs are just text). An
  advisory admin-form warning is deferred to §7 *later*, to add only if real usage
  shows unresolved/draft refs slipping in. (A hard reject was never on the table —
  it would deadlock "create A before B".)

---

## 7. MVP vs later

**MVP (Phase 5.1, ~M):**
- Marker syntax + the pure parse/flatten/slugs module (tested).
- Server-side resolution + link rendering + graceful degrade.
- `toJsonLd` flattening.
- Admin "insert recipe reference" picker.
- Skill: document the syntax + shape-check in `validate`.
- Migrate the chili example to the marker.

**Later (Phase 5.2+):**
- Inline **expand/disclosure** of a sub-recipe's ingredients under the line (with a
  cycle guard for A→B→A).
- Denormalized `refs` column + reverse index → **"used in these recipes"** backlinks
  on the sub-recipe page, and **dangling-reference warnings** when deleting or
  unpublishing a referenced recipe.
- Advisory existence warnings in the admin form (if the picker-only flow proves
  insufficient) — deferred from the MVP per §6.

---

## 8. Resolved decisions

- **Bare `[[slug]]` label → humanized slug** (pure, no DB), so render and the
  flattened JSON-LD/print agree. Explicit `[[slug|label]]` is preferred and is what
  the picker inserts (label from the title). See §1.
- **Advisory existence-warning is deferred**, not in the MVP: the picker + graceful
  degrade cover it; `SaveState` stays errors-only. See §6.
