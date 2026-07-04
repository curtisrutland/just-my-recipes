# Phase: MCP Server + OAuth + Editing

Status: **built · verified locally (OAuth + all 7 tools green via MCP Inspector)** · Target client: **claude.ai (web + mobile)**
Branch: **`mcp-oauth`** (all work for this phase lives here; keep `main` clean until it ships)
Claude plan: **Max** ✅ (custom-connector gate cleared)

## 1. Goal

Expose the recipe database to claude.ai as a **custom connector** (remote MCP server) so
Claude can search, read, create, and edit recipes directly while meal-planning — with
**OAuth** as the auth model and access restricted to **a single user (the owner)**.

## 2. Why this is a small lift

The write path already exists. `src/lib/queries.ts` has full CRUD
(`createRecipe`, `updateRecipe`, `deleteRecipe`) plus reads, all funneling through the
existing slugging, tag-derivation, owner-resolution, and visibility model. The HTTP API
(`src/app/api/recipes/**`) already mirrors the pattern we want.

**So this phase is not "build editing." It is:**
1. Add an MCP transport endpoint.
2. Put OAuth in front of it (claude.ai will not accept a static bearer token — see §4).
3. Register the existing mutations as MCP tools, with LLM-safety wrappers.
4. Gate everything to one user.

## 3. Non-goals (this phase)

- Multi-user / multi-publisher (the `users` table + `ownerId` FK already anticipate a v2;
  we do **not** build it now).
- Replacing the existing static-key HTTP API (`RECIPES_API_KEY`) — it stays for scripts/seed.
- A web admin UI. Editing happens through Claude.
- Per-recipe access control.

## 4. Auth architecture (the core decision)

### Why not a static token
claude.ai's custom-connector UI supports **only** OAuth or fully authless. It does **not**
accept a pasted bearer token, a custom `Authorization` header, or a `?token=` query param
(verified against Claude's connector auth docs). Since editing is the point, authless is out.
→ **OAuth it is.**

### Three-layer model
```
claude.ai  ──OAuth (DCR + S256 PKCE)──▶  Clerk (Authorization Server)
    │                                        issues bearer token
    └──────── MCP calls w/ Bearer ──────▶  Next.js route (Resource Server)
                                             verifyToken → allowlist check → tool → queries.ts
```

- **Authorization Server = Clerk.** It hosts `/authorize`, `/token`, discovery metadata, and
  the Dynamic Client Registration endpoint claude.ai needs. We do **not** hand-roll OAuth.
- **Resource Server = our Next.js app.** It (a) serves one metadata file at
  `/.well-known/oauth-protected-resource`, (b) validates bearer tokens via
  `mcp-handler`'s `withMcpAuth()`, returning `401` + `WWW-Authenticate` when unauthenticated.

### claude.ai's concrete requirements (from Claude connector docs)
- Probes from egress range `160.79.104.0/21`, requires `code_challenge_method=S256`.
- Uses **DCR** to self-register (Clerk supports this; toggle it on in the dashboard).
- Refreshes tokens reactively on 401 and ~5 min before expiry; `/token` must answer within
  10s (exchange) / 30s (refresh) — Clerk handles this.

### Provider choice: **Clerk** (recommended)
| Reason | Detail |
|---|---|
| Native to stack | Vercel Marketplace; `@clerk/mcp-tools` drops into `mcp-handler`'s `withMcpAuth()`. |
| Turnkey OAuth | Enable DCR in dashboard → Clerk serves all OAuth + metadata endpoints. |
| Identity in tools | Authenticated `userId` arrives at every tool via `authInfo.extra.userId`. |
| Cost | **$0** — free tier (50K users, unlimited apps, DCR) far exceeds a 1-user tool. |

Ruled out: **Stytch** (great MCP support but just acquired by Twilio → roadmap risk),
**WorkOS/Scalekit** (proxy-based, less turnkey with `mcp-handler` on Next.js),
**roll-your-own** (you'd be maintaining an OAuth 2.1 AS — not worth it).

> DCR note: Clerk's DCR endpoint is public/unauthenticated by design. Harmless here —
> a stranger can register a client but still cannot obtain a token that passes our
> single-user allowlist (§6). They'd have to log in *as you*.

### Single-user restriction (§6)
Not a Clerk feature — implemented in our `verifyToken`: reject any token whose
`userId !== CLERK_ALLOWED_USER_ID`.

## 5. MCP tools (thin wrappers over existing `queries.ts`)

Reuse existing functions; validate with `recipeWriteSchema` from `src/lib/recipe.ts`;
call `revalidateForRecipe(slug)` after every mutation (the API routes already do this — the
MCP path must not skip it or cached pages go stale).

| Tool | Backed by | Notes |
|---|---|---|
| `search_recipes` | `listRecipeRows({ includeDrafts: true, tag?, limit, offset })` | Owner sees drafts too. |
| `get_recipe` | `getRecipeRow(slug)` → `serializeRecipe` | Returns full JSON-LD doc. |
| `list_tags` | `getPublicTags` (or all tags) | For discovery. |
| `create_recipe` | `createRecipe(doc, visibility)` | Parse `recipeWriteSchema` first; return the new slug. |
| `update_recipe` | `updateRecipe(slug, doc, visibility?)` | **See merge safety below.** |
| `set_visibility` | `updateRecipe(slug, currentDoc, visibility)` | publish ↔ draft toggle. |
| `delete_recipe` | `deleteRecipe(slug)` | **See delete safety below.** |

### Editing-safety rules (these are the point of the tool layer)
- **`update_recipe` must MERGE, not replace.** The underlying `updateRecipe` does a **full
  document replace**; an LLM passing a partial doc would silently drop fields. The tool must:
  fetch current `data` → deep-merge provided fields → re-validate with `recipeWriteSchema` →
  call `updateRecipe`. Expose the merge behavior in the tool description.
- **Slug is immutable.** `update_recipe` keys on slug and must reject/ignore slug changes
  even when `name` changes (matches `updateRecipe` behavior). Renaming = new recipe.
- **Delete is destructive + non-transactional.** Recommend default = **soft** (a `set_visibility`
  to `draft` "unpublish") and make `delete_recipe` (hard delete) require an explicit
  `confirm: true` arg. Decision D2 below.
- **Validation errors are returned to the model**, not thrown — so Claude can self-correct.
- **Concurrency caveat:** neon-http has no interactive transactions; `createRecipe` upserts
  owner then inserts non-atomically. A rare slug race surfaces as a thrown DB unique-constraint
  error. Acceptable for single-user; the tool should surface it as a retryable error.

## 6. Data model changes

**None required for v1.** `ownerId` (NOT NULL FK) already exists and is resolved from
`OWNER_EMAIL` via `ensureOwnerId()` — independent of who authenticates. The Clerk user is
purely the *gate*; ownership still resolves to the env owner. We do **not** need to store the
Clerk user id in the DB.

Optional (defer): add `updatedBy`/audit columns if/when multi-user lands.

## 7. Files to add / change

New:
- `src/app/[transport]/route.ts` (or `src/app/mcp/route.ts`) — `createMcpHandler` + tool
  definitions, wrapped in `withMcpAuth(handler, verifyToken, { required: true, resourceMetadataPath })`.
  Export `{ authHandler as GET, authHandler as POST }` (GET only needed for SSE).
- `src/app/.well-known/oauth-protected-resource/route.ts` — `protectedResourceHandlerClerk`
  (from `@clerk/mcp-tools`) + `metadataCorsOptionsRequestHandler`. Export `GET` + `OPTIONS`.
- `src/lib/mcp/tools.ts` — tool schemas + the merge/safety logic from §5.
- `src/lib/mcp/auth.ts` — `verifyToken` = `verifyClerkToken(await auth({ acceptsToken: 'oauth_token' }), token)`
  + the `CLERK_ALLOWED_USER_ID` allowlist check.

Changed:
- `package.json` — add `mcp-handler`, `@clerk/nextjs`, `@clerk/mcp-tools`
  (+ `@modelcontextprotocol/sdk` if a peer). **Pin versions after reading each package's current
  docs — these APIs move fast; do not code from memory.**
- `middleware.ts` / `proxy.ts` — add `clerkMiddleware()` (Next.js 16 uses `proxy.ts`; confirm
  Clerk's current guidance for 16).
- `.env.local` / Vercel env — see §8.

Unchanged: `src/lib/queries.ts`, `src/lib/recipe.ts`, `src/lib/slug.ts`, existing HTTP API.

## 8. Config / env

Add: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_ALLOWED_USER_ID`
(your one Clerk user id, for the allowlist).
Keep: `DATABASE_URL`, `OWNER_EMAIL`, `OWNER_NAME`, `RECIPES_API_KEY` (HTTP API stays).

Clerk dashboard: create app → **enable Dynamic Client Registration** on the OAuth
applications page → set scopes.

Vercel: MCP over Streamable HTTP can hold an SSE connection — use **stateless** mode
(no session store, so **no Redis needed**). Confirm `maxDuration` / Fluid Compute defaults are
adequate. No WAF/IP allowlist needed (OAuth is the gate; drop the authless-era IP idea).

## 9. Rollout

1. Build behind OAuth locally; test with **MCP Inspector**
   (`npx @modelcontextprotocol/inspector`) — exercise the OAuth flow + each tool.
2. Deploy to a Vercel **preview** URL; add it as a custom connector in claude.ai; verify the
   OAuth consent screen + a real create→edit→publish round-trip from Claude.
3. Verify the allowlist: a second Clerk user (or no allowlist match) is rejected with 401/403.
4. Promote to production (`justmy.recipes`); re-point the connector at prod.

## 10. Verification checklist (definition of done)

- [ ] Unauthenticated MCP request → `401` with correct `WWW-Authenticate` resource metadata.
- [ ] claude.ai completes DCR + OAuth consent and lists all tools.
- [ ] `create_recipe` from Claude → recipe appears on the live site (cache revalidated).
- [ ] `update_recipe` with a *partial* payload preserves untouched fields (merge works).
- [ ] `delete_recipe` requires explicit confirm; `set_visibility` unpublish works.
- [ ] A non-allowlisted user cannot obtain access.
- [ ] Slug rename attempt via `update_recipe` is safely ignored.

## 11. Decisions

- **D1 — Provider:** ✅ **Clerk** ($0 free tier).
- **D2 — Delete semantics:** ✅ **Soft + guarded hard.** Default `set_visibility`→draft
  ("unpublish"); a separate `delete_recipe` requires explicit `confirm: true`.
- **D3 — Update semantics:** ✅ **Merge partial edits.** `update_recipe` fetches current doc,
  deep-merges provided fields, re-validates, saves. (Overrides the HTTP API's full-replace.)
- **D4 — API coexistence:** ✅ default — keep the static-key HTTP API alongside OAuth-MCP.
- **D5 — Endpoint path:** ✅ default — `/[transport]` (`mcp-handler` multi-transport convention).

D4/D5 taken as defaults; say so if you want them changed.

## 11b. Implementation log (what was actually built)

Installed: `mcp-handler@1.1.0`, `@clerk/nextjs@7.5.12`, `@clerk/mcp-tools@0.5.0`,
`@modelcontextprotocol/sdk` pinned to a single **1.29.0** via a package.json
`overrides` (mcp-handler pins 1.26.0, Clerk needs ^1.29.0 — override dedupes to one
copy so the shared `AuthInfo` type doesn't split).

Deviations from the original spec, all forced by **Next.js 16 Cache Components**:
- **`export const dynamic` is banned** under cacheComponents. The `.well-known` metadata
  routes call `await connection()` (from `next/server`) instead, to mark them runtime-dynamic.
- **Middleware file is `src/proxy.ts`**, not `middleware.ts` (Next 16 rename). Clerk's
  `clerkMiddleware()` works there — build output confirms `ƒ Proxy (Middleware)` is active.
- Tools expose **flat input schemas** (plain strings/arrays) and normalize through
  `recipeWriteSchema` server-side, rather than exposing the internal Zod unions/transforms
  to Claude as JSON Schema.

Files added:
- `src/proxy.ts` — clerkMiddleware + matcher.
- `src/lib/mcp/auth.ts` — `verifyToken`: verifyClerkToken + `CLERK_ALLOWED_USER_ID` allowlist.
- `src/lib/mcp/tools.ts` — 7 tools over `queries.ts` (merge-update, soft+guarded delete).
- `src/app/api/[transport]/route.ts` — `createMcpHandler` + `withMcpAuth`.
- `src/app/.well-known/oauth-protected-resource/route.ts` — RFC 9728 metadata.
- `src/app/.well-known/oauth-authorization-server/route.ts` — RFC 8414 metadata.
- `package.json` — deps + `overrides`.

**Connector URL** (register in claude.ai): `https://justmy.recipes/api/mcp`

Verified: `tsc --noEmit` clean; `next build` green; all MCP/metadata routes emit as
dynamic (`ƒ`); Clerk proxy active. **Runtime-verified locally via MCP Inspector** (dev Clerk
instance `vital-fox-61`): metadata endpoints serve correct RFC 9728/8414 docs pointing at
Clerk; DCR `registration_endpoint` live; unauth call returns the 401 `WWW-Authenticate`
challenge; full OAuth login (DCR → Clerk hosted login + email code → token) completes; the
single-user allowlist accepts the owner; all 7 tools execute green; DB left clean afterward.

### Done ✅
1. Clerk app created; **Dynamic Client Registration enabled**.
2. Owner Clerk user created; `CLERK_ALLOWED_USER_ID` set.
3. `.env.local` filled (dev keys `pk_test_`/`sk_test_`).
4. `npm run dev` + MCP Inspector: OAuth + all 7 tools verified green.

### Still to do
5. Deploy branch to a Vercel **preview**; set the 3 Clerk env vars in Vercel (dev keys OK for
   preview); add `https://<preview>/api/mcp` as a claude.ai custom connector; verify from
   claude.ai itself.
6. **Production** (`justmy.recipes`): stand up a Clerk **production instance** (add the domain
   + Clerk Frontend-API DNS, use `pk_live_`/`sk_live_`), set prod env, merge to `main`,
   register the production connector at `https://justmy.recipes/api/mcp`.

## 12. Risks / watch-items

- **Docs drift:** `mcp-handler`, `@clerk/mcp-tools`, and the MCP auth spec change often. Read
  each package's current docs before writing code; pin versions.
- **Next.js 16 specifics:** confirm Clerk middleware is `proxy.ts` (not `middleware.ts`) and
  that `withMcpAuth` route conventions match App Router 16.
- **Plan gate:** ✅ resolved — user is on Max (custom connectors require Pro/Max).
- **Non-atomic writes** under neon-http (§5) — acceptable for single-user, note for v2.
