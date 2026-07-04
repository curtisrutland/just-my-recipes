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

- `manage-recipes/` — full CRUD suite (`SKILL.md` + `recipes.py`). Covers the
  same ground as the MCP tools: list, get, tags, create, update (merge),
  set-visibility, delete.
- Templates use `{{VAR}}` placeholders (token, API base) — **no secrets in git**.

## Build & install

```bash
npm run skills:build        # injects RECIPES_PUBLISH_TOKEN from .env.local
```

This emits ready-to-upload copies into `.skills-dist/` (gitignored, real token
baked in). Upload a skill's folder to **claude.ai → Settings → Capabilities /
Skills**. In settings, enable Code execution + network egress and add
`justmy.recipes` to the domain allowlist.

## Auth

Skills authenticate with `RECIPES_PUBLISH_TOKEN` (a write token separate from
`RECIPES_API_KEY`, accepted by `src/lib/auth.ts`). It only grants recipe writes
and is independently revocable: rotate it in `.env.local` + Vercel, rebuild, and
re-upload the skill. The `SKILLS_API_BASE` env var overrides the target origin
(defaults to `https://justmy.recipes`; do **not** use `NEXT_PUBLIC_SITE_URL` —
that's localhost in dev).
