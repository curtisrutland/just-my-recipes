---
name: manage-recipes
description: >-
  Read and write recipes on the user's site justmy.recipes — list, view, create,
  edit, and publish/unpublish. Use whenever the user wants to see, add, change,
  publish, or hide recipes on their site. Requires code execution with network
  egress allowed for justmy.recipes.
---

# Manage recipes on justmy.recipes

Read and write access (no delete) over the user's recipe site via its REST API,
using the bundled `recipes.py` (standard library only; the API token is already
embedded).

## Operations

Run `python recipes.py <command>`:

| Command | What it does |
|---|---|
| `list [--public-only] [--tag T] [--limit N] [--offset N]` | List recipes. **Drafts are included by default** (you have write access); add `--public-only` to preview just what the public sees. |
| `get <slug>` | Full recipe JSON by slug. |
| `tags` | All tags currently in use (scans the 100 most recent recipes). |
| `create <recipe.json>` | Create a recipe. |
| `update <slug> <patch.json>` | **Merge** the patch into an existing recipe. |
| `set-visibility <slug> <public\|draft>` | Publish or unpublish. |
| `search <text> [--tag T] [--limit N] [--offset N] [--public-only]` | Free-text search over name, description, ingredients, notes. |
| `validate [--patch] <recipe.json>` | **Offline** schema check — no network. Add `--patch` to check an `update` patch (`name`/`recipeIngredient` not required). |

For `create`, `update`, and `validate`, write the JSON to a file first, then pass its path.

## Behavior & safety rules

- **Default new recipes to `draft`** unless the user explicitly asks to publish
  publicly. Drafts are saved but hidden from the public site.
- **`update` is a merge:** only the fields you put in the patch change; omitted
  fields are preserved. The **slug never changes**, even if you change `name`. A
  `null` value in a patch is **ignored** (it does not clear a field); to empty an
  array, send `[]`.
- **Adding to an array is NOT a partial patch.** `recipeIngredient`,
  `recipeInstructions`, and `keywords` are replaced *entirely* when included in a
  patch. To *add* an item (e.g. "add cumin"), first `get <slug>`, append to the
  existing array, and send the **full** array back. Never send a single new element
  as the whole array — it deletes the rest.
- **Editing instructions:** on read, steps come back as `HowToStep` objects
  (`{"name"?, "text"}`). If a recipe has step headings (`name`), send instructions
  back as full `HowToStep` objects so the headings aren't lost — a plain-string
  instructions patch on a recipe that already has headings is refused by the tool.
- **To take a recipe off the site, unpublish it** with `set-visibility <slug> draft`
  (reversible). This Skill cannot permanently delete recipes — that's an
  owner-only operation done directly against the API. If the user asks to delete,
  unpublish it and tell them permanent deletion is done separately.
- **`search` vs `list --tag`:** `search` is *fuzzy free-text* over name, description,
  ingredients, and notes ("find the venison thing"). `--tag` is an *exact* match on a
  recipe's keywords/category/cuisine. Use `search` for prose, `--tag` for a known tag;
  they compose — `search "braise" --tag weeknight` matches "braise" in text **and** the
  "weeknight" tag. Drafts are included by default (like `list`); `--public-only` drops them.
- **Preflight with `validate`** before `create`/`update` on anything nontrivial: it
  checks the JSON against the schema **locally, no network**, and prints errors as a
  field-path → message map (plus warnings for likely typos). Fix errors before writing.
  It's advisory — the server still validates — but it catches mistakes cheaply. A common
  one it flags hard: nutrition values written as `"22 g"` strings instead of numbers.
  **Validating an `update` patch? Pass `--patch`** — a patch sends only the fields you're
  changing, so without it `validate` falsely fails on missing `name`/`recipeIngredient`.
  `--patch` drops just those two required checks; every present field is still type-checked.
- **On success, report what the command prints:** `create` and `update` print the
  recipe's public URL; `set-visibility` prints a confirmation (`<slug> is now
  public` / `draft`), **not** a URL; `list`, `get`, `tags`, and `search` print
  data to relay to the user. On a validation error, fix the JSON and retry.

## Recipe JSON schema (for create / update patches)

```jsonc
{
  "name": "Chili con Carne",            // required for create; string
  "recipeIngredient": [                  // required for create; array of strings, >=1
    "1 lb ground beef",
    "2 tbsp chili paste"
  ],
  "description": "A hearty weeknight chili.",   // optional
  "image": "https://…/photo.jpg",               // optional, URL
  "recipeYield": "4 servings",                   // optional; string (a number is accepted, coerced)
  "prepTime": "PT20M",                            // optional, ISO 8601 duration
  "cookTime": "PT45M",                            // optional, ISO 8601 duration
  "totalTime": "PT65M",                           // optional, ISO 8601 duration
  "recipeInstructions": [                          // optional; strings OR HowToStep objects
    "Brown the beef.",                             //   a plain string, OR…
    { "@type": "HowToStep", "name": "Simmer",      //   …an object with an optional short heading
      "text": "Stir in the chili paste and simmer 40 minutes." }
  ],                                               // NOTE: reads always return these as HowToStep[]
  "recipeCategory": ["dinner"],                    // optional, array of strings
  "recipeCuisine": ["tex-mex"],                    // optional, array of strings
  "keywords": ["chili", "beef"],                   // optional, array of strings
  "notes": "Better the next day.",                 // optional, freeform
  "nutrition": {                                    // optional; schema.org, PER SERVING
    "calories": 420,                                //   plain NUMBERS only — never "22 g"
    "proteinContent": 31,                           //   grams
    "fatContent": 22,
    "carbohydrateContent": 18
    // also allowed: fiberContent, sugarContent, sodiumContent, saturatedFatContent
  },
  "visibility": "draft"                            // optional: "public" | "draft"
}
```

Durations are ISO 8601 (`PT20M` = 20 min, `PT1H30M` = 90 min). The server
generates the slug from `name`; never set an id or slug. For an `update` patch,
include only the fields you want to change.

**Nutrition is numbers, not strings.** Values are plain numbers — grams for the
macros, kcal for `calories` — **per serving** (paired with `recipeYield`). Do **not**
write `"22 g"`; write `22`. The site adds units when it renders; the API stores and
returns numbers so they stay computable.
