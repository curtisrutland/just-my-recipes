# Environment variables

Every variable the app reads, grouped by the surface that needs it. Local dev reads
`.env.local` (gitignored); production reads Vercel project env vars. `vercel env pull
.env.local` syncs them down.

> This repo is public — never commit real values. Templates carry placeholders only.

## Core (site + database)

| Variable | Required | Read by | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | `src/lib/db`, `drizzle.config.ts` | Neon connection string. **Injected** by the Vercel↔Neon integration; set automatically in Vercel, pulled into `.env.local`. |
| `NEXT_PUBLIC_SITE_URL` | yes | `src/lib/site.ts` (canonical URLs, JSON-LD, OpenGraph) | `https://justmy.recipes` in prod; `http://localhost:3000` in dev. Public (bundled into the client). |
| `OWNER_EMAIL` | yes (writes) | `src/lib/queries.ts` (`ensureOwnerId`), seed | The single owner's email — the `users` row is created lazily from it on first write. |
| `OWNER_NAME` | yes (writes) | `src/lib/queries.ts`, seed | Owner display name. |

## REST API auth (two tokens)

| Variable | Required | Read by | Notes |
|---|---|---|---|
| `RECIPES_API_KEY` | yes | `src/lib/auth.ts` | **Primary** write key. Accepted on all writes; the **only** key accepted for `DELETE` (hard delete). |
| `RECIPES_PUBLISH_TOKEN` | optional | `src/lib/auth.ts`, `scripts/build-skills.mjs` | Separate, independently-revocable write token for the claude.ai Skill. Accepted on create/update and for reading drafts; **rejected** for `DELETE`. Baked into the built Skill by `skills:build`. |

See `src/lib/auth.ts`: `isAuthorized` accepts either token; `isPrimaryKey` accepts only `RECIPES_API_KEY`.

## Admin UI + MCP (Clerk)

| Variable | Required | Read by | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes (for `/admin`) | Clerk SDK (`ClerkProvider`, `clerkMiddleware`) — read implicitly | Public. Currently a **dev-instance** `pk_test_…` key (see `docs/deploy.md`). |
| `CLERK_SECRET_KEY` | yes (for `/admin`) | Clerk SDK — read implicitly | Secret. Dev-instance `sk_test_…`. |
| `CLERK_ALLOWED_USER_ID` | yes (for `/admin` + MCP) | `src/lib/admin/auth.ts`, `src/lib/mcp/auth.ts` | The single owner's Clerk user id — the allowlist. A signed-in user whose id ≠ this is rejected (404 on `/admin`, 401 on MCP). |

Clerk is scoped to `/admin` + MCP only (`src/proxy.ts` matcher); the public site never reads these.

## Build-time only

| Variable | Required | Read by | Notes |
|---|---|---|---|
| `SKILLS_API_BASE` | optional | `scripts/build-skills.mjs` | Origin the built Skill targets. Defaults to `https://justmy.recipes`. **Do not** use `NEXT_PUBLIC_SITE_URL` for this — that's `localhost` in dev, which would bake a localhost URL into the uploaded Skill. |

## Which are set where

- **Injected automatically** (don't set by hand): `DATABASE_URL`.
- **Set in Vercel + `.env.local`**: everything else. Minimum for a working prod deploy:
  `RECIPES_API_KEY`, `RECIPES_PUBLISH_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `OWNER_EMAIL`,
  `OWNER_NAME`, and the three `CLERK_*` vars.
- **Build-machine only** (already in `.env.local`, not needed in Vercel runtime):
  `SKILLS_API_BASE` (optional).
