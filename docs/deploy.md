# Deployment & runbook

How justmy.recipes is built, deployed, and operated. Env vars: `docs/environment.md`.
System map: `docs/architecture.md`.

## Hosting

- **Vercel**, Next.js framework preset. **Production auto-deploys on push to `main`** (Git
  integration). Preview deploys build on other branches/PRs.
- `prebuild` runs `scripts/build-openapi.mjs`, regenerating `public/openapi.{yaml,json}` from
  `openapi.yaml`, then `next build` prerenders the public pages.
- `/admin` renders dynamically (owner-gated); public pages are static/PPR and revalidate on write.

## First-time / re-provisioning setup

1. **Database** — provision **Neon Postgres** via the Vercel Marketplace integration; it injects
   `DATABASE_URL`. Then `npm run db:migrate` (and `npm run db:seed` for a fresh dev DB).
2. **Environment** — set the vars from `docs/environment.md` in the Vercel project (Production +
   Preview). Minimum: `RECIPES_API_KEY`, `RECIPES_PUBLISH_TOKEN`, `NEXT_PUBLIC_SITE_URL`,
   `OWNER_EMAIL`, `OWNER_NAME`, and the three `CLERK_*` vars. `vercel env pull .env.local` locally.
3. **Clerk** — see below.
4. **Domain** — add `justmy.recipes` as a custom domain in Vercel and point the apex record at
   Vercel per its custom-domain instructions (DNS lives at the domain registrar, not Vercel).

## Clerk (auth for /admin + MCP)

- Currently the Clerk **development instance** is reused in production (a deliberate solo-tool
  shortcut). It works, but shows Clerk dev-mode affordances and uses `pk_test_`/`sk_test_` keys.
- The owner is pinned by `CLERK_ALLOWED_USER_ID` — set it to your Clerk user id (visible on the
  `/admin` shell once signed in, or via the Clerk dashboard).
- **Upgrading to a Clerk production instance** (tracked in `docs/enhancements.md`) needs: a
  Frontend-API CNAME on the domain (DNS), `pk_live_`/`sk_live_` keys swapped in Vercel, and
  re-creating the owner user on the fresh instance (separate user pool → new `CLERK_ALLOWED_USER_ID`).

## Skill release (claude.ai)

The `manage-recipes` Skill ships separately from the site — it is **not** part of the Vercel build.

1. `npm run skills:build` — injects `RECIPES_PUBLISH_TOKEN` + `SKILLS_API_BASE` into the gitignored
   `skills-dist/` and emits `skills-dist/manage-recipes.zip`.
2. Upload that zip to **claude.ai → Settings → Skills** (Replace to update). Enable code execution
   + network egress and allowlist `justmy.recipes`.
3. **Re-upload after any change** to `skills/manage-recipes/` (a git push does not update claude.ai).
4. **Token rotation** — if `RECIPES_PUBLISH_TOKEN` leaks: change it in `.env.local` + Vercel
   (`vercel env rm/add`), `skills:build`, re-upload. The old token is immediately dead; it's
   full-write-but-not-delete, so a leak can't hard-delete recipes.

## Verifying a deploy

```bash
# after the Vercel deploy reports Ready:
curl -s -o /dev/null -w '%{http_code}\n' https://justmy.recipes/                       # 200
curl -s -o /dev/null -w '%{http_code}\n' https://justmy.recipes/recipes/<any-slug>     # 200
curl -s -o /dev/null -D - https://justmy.recipes/admin | grep -i '^location'           # 307 → Clerk sign-in
```

- **Known transient:** immediately after a deploy that *adds a new route* (e.g. the first
  `/admin` deploy), the edge can briefly serve a **stale cached 404** for that path (the old build
  had no such route). It clears on revalidation / a hard refresh, and only affects the just-added
  path — the rest of the site is unaffected. Not a real error.

## Rollback

Use the Vercel dashboard → Deployments → promote a previous **Ready** production deployment (or
`vercel rollback`). The DB is shared across deploys, so a code rollback does **not** revert data.
