#!/usr/bin/env python3
"""Manage recipes on {{API_BASE}} — the full CRUD suite (mirrors the MCP tools).

Subcommands:
  list [--public-only] [--tag T] [--limit N] [--offset N]
                                             list recipes (drafts included by
                                             default; --public-only = public view)
  get <slug>                                 full recipe by slug (incl. drafts)
  tags                                       all tags currently in use
  create <recipe.json>                       create (draft unless visibility=public)
  update <slug> <patch.json>                 MERGE patch into an existing recipe
  set-visibility <slug> <public|draft>       publish / unpublish
  search <text> [--tag T] [--limit N] [--offset N] [--public-only]
                                             free-text search over name, description,
                                             ingredients, notes (drafts by default)
  validate <recipe.json>                     check a recipe/patch locally, offline

To take a recipe off the site, unpublish it (set-visibility draft). Permanent
deletion is intentionally NOT available here — it is an owner-only operation.

Recipe JSON schema is documented in SKILL.md. Standard library only.
Values are injected at build time from .env.local (do not hand-edit).
"""
import json
import re
import sys
import urllib.error
import urllib.parse
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
    # Owner-facing default: show everything, drafts included (you have write access).
    # `--public-only` omits include=drafts to preview exactly what the public sees.
    params = []
    public_only = False
    it = iter(args)
    for a in it:
        if a == "--public-only":
            public_only = True
        elif a == "--tag":
            params.append(f"tag={next(it)}")
        elif a == "--limit":
            params.append(f"limit={next(it)}")
        elif a == "--offset":
            params.append(f"offset={next(it)}")
    if not public_only:
        params.append("include=drafts")
    query = f"?{'&'.join(params)}" if params else ""
    status, body = _req("GET", f"/api/recipes{query}", auth=True)
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

    # Guard: a plain-string instructions patch must not silently drop step headings
    # (HowToStep.name) that already exist on the recipe. If it would, refuse and tell
    # the caller to send full HowToStep objects.
    if patch.get("recipeInstructions") is not None:
        current_has_headings = any(
            isinstance(s, dict) and s.get("name")
            for s in (current.get("recipeInstructions") or [])
        )
        patch_has_strings = any(isinstance(s, str) for s in patch["recipeInstructions"])
        if current_has_headings and patch_has_strings:
            _die(
                f"Refusing: '{slug}' has step headings (HowToStep.name) and this "
                "instructions patch uses plain strings, which would drop them. Send full "
                'HowToStep objects like [{"name": "...", "text": "..."}]; '
                f"run 'get {slug}' to see the current steps."
            )

    merged = _doc(current)
    # Shallow-merge only supplied fields; arrays are replaced wholesale (see SKILL.md).
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


def cmd_search(args):
    text = None
    extra = []  # (key, value) query params passed through to the API
    public_only = False
    it = iter(args)
    for a in it:
        if a == "--public-only":
            public_only = True
        elif a == "--tag":
            extra.append(("tag", next(it)))
        elif a == "--limit":
            extra.append(("limit", next(it)))
        elif a == "--offset":
            extra.append(("offset", next(it)))
        elif text is None:
            text = a
        else:
            _die(f"unexpected argument: {a}")
    if not text or not text.strip():
        _die("usage: search <text> [--tag T] [--limit N] [--offset N] [--public-only]")

    # Dependency gate: the API silently ignores unknown query params, so if `q` isn't
    # live a search would return EVERYTHING. Probe with an impossible token first — if
    # it still matches anything, `q` is being ignored; abort loudly rather than mislead.
    probe_qs = urllib.parse.urlencode(
        [("q", "zzqx_no_such_recipe_9f3k_probe"), ("limit", "1"), ("include", "drafts")]
    )
    status, body = _req("GET", f"/api/recipes?{probe_qs}", auth=True)
    if status != 200:
        _die(f"search probe failed ({status}): {body}")
    if body.get("count") or body.get("recipes"):
        _die(
            "Aborting: the API is ignoring the `q` parameter (an impossible query still "
            "returned results), so search would silently return everything. The API's `q` "
            "support must be deployed before search can be used."
        )

    query = [("q", text.strip()), *extra]
    if not public_only:
        query.append(("include", "drafts"))
    status, body = _req("GET", f"/api/recipes?{urllib.parse.urlencode(query)}", auth=True)
    if status != 200:
        _die(f"search failed ({status}): {body}")
    for r in body["recipes"]:
        print(f"{r['slug']}  [{r['visibility']}]  {r.get('name', '')}")


# --- validate: offline schema check ------------------------------------------------
# Rules transcribed from the live schema as of Phase 3 (2026-07): Recipe / RecipeWrite
# / HowToStep / NutritionInformation in openapi.yaml + src/lib/recipe.ts. This is an
# offline convenience mirror of server validation, NOT the source of truth (the server
# still validates on write). stdlib only; do NOT fetch the spec at runtime. Keep in
# sync with recipe.ts when the schema changes.
_ISO8601_DURATION = re.compile(
    r"^P(?=\d|T\d)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(?:\.\d+)?S)?)?$"
)
_KNOWN_TOP_FIELDS = {
    "name", "description", "image", "recipeYield", "prepTime", "cookTime", "totalTime",
    "recipeIngredient", "recipeInstructions", "recipeCategory", "recipeCuisine",
    "keywords", "notes", "nutrition", "visibility",
}
_NUTRITION_KEYS = {
    "calories", "proteinContent", "fatContent", "carbohydrateContent",
    "fiberContent", "sugarContent", "sodiumContent", "saturatedFatContent",
}


def _nonempty_str(v):
    return isinstance(v, str) and v.strip() != ""


def _is_number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def cmd_validate(args):
    if not args:
        _die("usage: validate <recipe.json>")
    try:
        with open(args[0]) as f:
            doc = json.load(f)
    except json.JSONDecodeError as e:
        _die(f"invalid JSON: {e}")
    if not isinstance(doc, dict):
        _die("top-level value must be a JSON object")

    errors = {}      # path -> [messages]  (mirrors the API's error.details)
    warnings = []    # human-readable strings

    def err(path, msg):
        errors.setdefault(path, []).append(msg)

    # name — required
    if "name" not in doc:
        err("name", "required")
    elif not _nonempty_str(doc["name"]):
        err("name", "must be a non-empty string")

    # recipeIngredient — required, >=1 non-empty strings
    ri = doc.get("recipeIngredient")
    if ri is None:
        err("recipeIngredient", "required")
    elif not isinstance(ri, list) or len(ri) < 1:
        err("recipeIngredient", "must be a non-empty array of strings")
    else:
        for i, el in enumerate(ri):
            if not _nonempty_str(el):
                err(f"recipeIngredient.{i}", "must be a non-empty string")

    # recipeInstructions — optional; string or HowToStep
    ins = doc.get("recipeInstructions")
    if ins is not None:
        if not isinstance(ins, list):
            err("recipeInstructions", "must be an array")
        else:
            for i, el in enumerate(ins):
                p = f"recipeInstructions.{i}"
                if isinstance(el, str):
                    if el.strip() == "":
                        err(p, "step string must be non-empty")
                elif isinstance(el, dict):
                    if not _nonempty_str(el.get("text")):
                        err(f"{p}.text", "required, non-empty")
                    if "name" in el:
                        if not _nonempty_str(el["name"]):
                            err(f"{p}.name", "if present, must be non-empty")
                        elif len(el["name"]) > 120:
                            err(f"{p}.name", "max 120 characters")
                    if "@type" in el and el["@type"] != "HowToStep":
                        err(f"{p}.@type", 'must be "HowToStep"')
                else:
                    err(p, "must be a string or a HowToStep object")

    # image — optional; basic http(s) URL
    if "image" in doc and not (
        _nonempty_str(doc["image"]) and re.match(r"^https?://[^\s]+$", doc["image"])
    ):
        err("image", "must be a valid http(s) URL")

    # durations — optional; ISO 8601
    for fld in ("prepTime", "cookTime", "totalTime"):
        if fld in doc and not (isinstance(doc[fld], str) and _ISO8601_DURATION.match(doc[fld])):
            err(fld, "must be an ISO 8601 duration, e.g. PT20M or PT1H30M")

    # recipeYield — optional string; number is a warning (coerced server-side)
    if "recipeYield" in doc:
        v = doc["recipeYield"]
        if _is_number(v):
            warnings.append("recipeYield: number is coerced to a string server-side; a string like '4 servings' is clearer")
        elif not isinstance(v, str):
            err("recipeYield", "must be a string")

    # category / cuisine / keywords — optional; string or array of strings
    for fld in ("recipeCategory", "recipeCuisine", "keywords"):
        if fld in doc:
            v = doc[fld]
            if not (isinstance(v, str) or (isinstance(v, list) and all(isinstance(x, str) for x in v))):
                err(fld, "must be a string or an array of strings")

    # visibility — optional enum
    if "visibility" in doc and doc["visibility"] not in ("public", "draft"):
        err("visibility", 'must be "public" or "draft"')

    # notes / description — optional strings
    for fld in ("notes", "description"):
        if fld in doc and not isinstance(doc[fld], str):
            err(fld, "must be a string")

    # nutrition — optional object of non-negative numbers (units-in-a-string is an ERROR)
    if "nutrition" in doc:
        nut = doc["nutrition"]
        if not isinstance(nut, dict):
            err("nutrition", "must be an object of numeric values")
        else:
            for k, v in nut.items():
                p = f"nutrition.{k}"
                if k in _NUTRITION_KEYS:
                    if not _is_number(v):
                        err(p, "use a plain number, grams/kcal implied, per serving (not a string like '22 g')")
                    elif v < 0:
                        err(p, "must be non-negative")
                else:
                    warnings.append(f"nutrition.{k}: unknown key — dropped on write (did you mean e.g. proteinContent?)")

    # unknown top-level fields — server strips silently, so warn (likely a typo)
    for k in doc:
        if k not in _KNOWN_TOP_FIELDS:
            warnings.append(f"{k}: unknown top-level field — silently dropped on write (typo?)")

    for w in warnings:
        print(f"warning: {w}", file=sys.stderr)
    if errors:
        print("validation failed — the server would reject this:", file=sys.stderr)
        print(json.dumps(errors, indent=2, sort_keys=True), file=sys.stderr)
        sys.exit(1)
    print("OK — valid" + (f" ({len(warnings)} warning(s))" if warnings else ""))


CMDS = {
    "list": cmd_list,
    "get": cmd_get,
    "tags": cmd_tags,
    "create": cmd_create,
    "update": cmd_update,
    "set-visibility": cmd_set_visibility,
    "search": cmd_search,
    "validate": cmd_validate,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in CMDS:
        _die(f"usage: python recipes.py <{'|'.join(CMDS)}> [args]", 2)
    CMDS[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
