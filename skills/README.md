# claude.ai Skills

Templates for [Claude Skills](https://claude.com/docs) that let claude.ai (web
and mobile) manage recipes on the site through its existing REST API — the
working alternative to the custom MCP connector, which is blocked by an
Anthropic-side tool-injection bug (see `docs/mcp-oauth-phase.md`).

## Why Skills instead of the MCP connector

claude.ai's code-execution sandbox can call external HTTPS APIs when **Code
execution** + **Allow network egress** are on and the domain is allowlisted. A
Skill bundles a script that POSTs to `/api/recipes`, so Claude publishes without
any connector. This path works on web and mobile.

## Layout

- `manage-recipes/` — read + write suite (`SKILL.md` + `recipes.py`). Covers the
  same ground as the MCP tools: list, get, tags, search, create, update (merge),
  set-visibility, validate. **No delete** — hard delete is owner-only (see below).
- Templates use `{{VAR}}` placeholders (token, API base) — **no secrets in git**.

## Build & install

```bash
npm run skills:build        # injects RECIPES_PUBLISH_TOKEN from .env.local
```

This emits, into the gitignored `skills-dist/` (real token baked in), for each
skill both the folder and a sibling **`<skill>.zip`** ready to upload. Upload
`skills-dist/<skill>.zip` to **claude.ai → Settings → Capabilities / Skills**. In
settings, enable Code execution + network egress and add `justmy.recipes` to the
domain allowlist.

## Auth & token threat model (deliberate decision)

Skills authenticate with `RECIPES_PUBLISH_TOKEN` — a write token separate from
`RECIPES_API_KEY`, accepted by `src/lib/auth.ts`. Scope:

- **Grants:** create, update (full-field rewrite of any recipe), set-visibility.
- **Does NOT grant:** hard delete. `DELETE /api/recipes/{slug}` requires the primary
  `RECIPES_API_KEY` (`isPrimaryKey()`); the publish token is rejected there.

**Why the token is embedded in `recipes.py` (not read from an env var):** the Skill
runs in claude.ai's code-execution sandbox, which exposes **no** user-settable
environment variables — there is no channel to inject a secret except the Skill's own
files. So embedding is the only option in this context.

**Why that's acceptable here** — the repo never carries the live token:
- The committed template (`skills/`) contains only the `{{RECIPES_PUBLISH_TOKEN}}`
  placeholder. The real value is injected by `npm run skills:build` into the
  **gitignored** `skills-dist/`, and lives otherwise only in the owner's private
  claude.ai account. Nothing with the real token is ever committed or pushed.
- The token is **full-write but not delete**, single-publisher, and **revocable**: if
  it leaks, rotate it in `.env.local` + Vercel (`vercel env rm/add`), rebuild, and
  re-upload the Skill; the old token is dead.

This is an explicit accepted trade-off for a solo personal site, not an oversight.

`SKILLS_API_BASE` overrides the target origin (defaults to `https://justmy.recipes`;
do **not** use `NEXT_PUBLIC_SITE_URL` — that's localhost in dev).
