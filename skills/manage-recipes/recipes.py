#!/usr/bin/env python3
"""Manage recipes on {{API_BASE}} — the full CRUD suite (mirrors the MCP tools).

Subcommands:
  list [--tag T] [--limit N] [--offset N]   list recipes, incl. drafts
  get <slug>                                 full recipe by slug (incl. drafts)
  tags                                       all tags currently in use
  create <recipe.json>                       create (draft unless visibility=public)
  update <slug> <patch.json>                 MERGE patch into an existing recipe
  set-visibility <slug> <public|draft>       publish / unpublish

To take a recipe off the site, unpublish it (set-visibility draft). Permanent
deletion is intentionally NOT available here — it is an owner-only operation.

Recipe JSON schema is documented in SKILL.md. Standard library only.
Values are injected at build time from .env.local (do not hand-edit).
"""
import json
import sys
import urllib.error
import urllib.request

API_BASE = "{{API_BASE}}"
TOKEN = "{{RECIPES_PUBLISH_TOKEN}}"

# Server-managed fields returned on reads that must be stripped before writing back.
_MANAGED = {"slug", "tags", "createdAt", "updatedAt"}


def _req(method, path, body=None, auth=False):
    headers = {"Content-Type": "application/json"}
    if auth:
        headers["Authorization"] = f"Bearer {TOKEN}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{API_BASE}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            text = resp.read().decode()
            return resp.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        try:
            detail = json.loads(detail)
        except Exception:
            pass
        return e.code, detail


def _die(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def _doc(serialized):
    """Recover the editable recipe document from a server read."""
    return {k: v for k, v in serialized.items() if k not in _MANAGED}


def cmd_list(args):
    params = ["include=drafts"]
    it = iter(args)
    for a in it:
        if a == "--tag":
            params.append(f"tag={next(it)}")
        elif a == "--limit":
            params.append(f"limit={next(it)}")
        elif a == "--offset":
            params.append(f"offset={next(it)}")
    status, body = _req("GET", f"/api/recipes?{'&'.join(params)}", auth=True)
    if status != 200:
        _die(f"list failed ({status}): {body}")
    for r in body["recipes"]:
        print(f"{r['slug']}  [{r['visibility']}]  {r.get('name', '')}")


def cmd_get(args):
    if not args:
        _die("usage: get <slug>")
    status, body = _req("GET", f"/api/recipes/{args[0]}", auth=True)
    if status != 200:
        _die(f"get failed ({status}): {body}")
    print(json.dumps(body, indent=2))


def cmd_tags(_args):
    status, body = _req("GET", "/api/recipes?include=drafts&limit=100", auth=True)
    if status != 200:
        _die(f"tags failed ({status}): {body}")
    tags = sorted({t for r in body["recipes"] for t in r.get("tags", [])})
    print("\n".join(tags))


def cmd_create(args):
    if not args:
        _die("usage: create <recipe.json>")
    with open(args[0]) as f:
        recipe = json.load(f)
    status, body = _req("POST", "/api/recipes", body=recipe, auth=True)
    if status != 201:
        _die(f"create failed ({status}): {json.dumps(body)}")
    print(f"Created: {API_BASE}/recipes/{body['slug']}")


def cmd_update(args):
    if len(args) < 2:
        _die("usage: update <slug> <patch.json>")
    slug = args[0]
    with open(args[1]) as f:
        patch = json.load(f)
    status, current = _req("GET", f"/api/recipes/{slug}", auth=True)
    if status != 200:
        _die(f"update: recipe '{slug}' not found ({status})")
    merged = _doc(current)
    # Shallow-merge only supplied fields; arrays are replaced wholesale.
    merged.update({k: v for k, v in patch.items() if v is not None})
    status, body = _req("PUT", f"/api/recipes/{slug}", body=merged, auth=True)
    if status != 200:
        _die(f"update failed ({status}): {json.dumps(body)}")
    print(f"Updated: {API_BASE}/recipes/{body['slug']}")


def cmd_set_visibility(args):
    if len(args) < 2 or args[1] not in ("public", "draft"):
        _die("usage: set-visibility <slug> <public|draft>")
    slug, vis = args[0], args[1]
    status, current = _req("GET", f"/api/recipes/{slug}", auth=True)
    if status != 200:
        _die(f"'{slug}' not found ({status})")
    doc = _doc(current)
    doc["visibility"] = vis
    status, body = _req("PUT", f"/api/recipes/{slug}", body=doc, auth=True)
    if status != 200:
        _die(f"set-visibility failed ({status}): {json.dumps(body)}")
    print(f"{slug} is now {vis}")


CMDS = {
    "list": cmd_list,
    "get": cmd_get,
    "tags": cmd_tags,
    "create": cmd_create,
    "update": cmd_update,
    "set-visibility": cmd_set_visibility,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in CMDS:
        _die(f"usage: python recipes.py <{'|'.join(CMDS)}> [args]", 2)
    CMDS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
