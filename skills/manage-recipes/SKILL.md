---
name: manage-recipes
description: >-
  Read and write recipes on the user's site justmy.recipes — list, view, create,
  edit, and publish/unpublish. Use whenever the user wants to see, add, change,
  publish, or hide recipes on their site. Requires code execution with network
  egress allowed for justmy.recipes.
---

# Manage recipes on justmy.recipes

Full CRUD over the user's recipe site via its REST API, using the bundled
`recipes.py` (standard library only; the API token is already embedded).

## Operations

Run `python recipes.py <command>`:

| Command | What it does |
|---|---|
| `list [--tag T] [--limit N] [--offset N]` | List recipes (includes drafts). |
| `get <slug>` | Full recipe JSON by slug. |
| `tags` | All tags currently in use. |
| `create <recipe.json>` | Create a recipe. |
| `update <slug> <patch.json>` | **Merge** the patch into an existing recipe. |
| `set-visibility <slug> <public\|draft>` | Publish or unpublish. |

For `create` and `update`, write the JSON to a file first, then pass its path.

## Behavior & safety rules

- **Default new recipes to `draft`** unless the user explicitly asks to publish
  publicly. Drafts are saved but hidden from the public site.
- **`update` is a merge:** only the fields you put in the patch change; omitted
  fields are preserved. Arrays (ingredients, instructions, keywords) are replaced
  wholesale when included. The **slug never changes**, even if you change `name`.
- **To take a recipe off the site, unpublish it** with `set-visibility <slug> draft`
  (reversible). This Skill cannot permanently delete recipes — that's an
  owner-only operation done directly against the API. If the user asks to delete,
  unpublish it and tell them permanent deletion is done separately.
- On a validation error, fix the JSON and retry; report the printed URL on success.

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
  "recipeYield": "4 servings",                   // optional, string
  "prepTime": "PT20M",                            // optional, ISO 8601 duration
  "cookTime": "PT45M",                            // optional, ISO 8601 duration
  "totalTime": "PT65M",                           // optional, ISO 8601 duration
  "recipeInstructions": [                          // optional, array of step strings
    "Brown the beef.",
    "Stir in the chili paste and simmer 40 minutes."
  ],
  "recipeCategory": ["dinner"],                    // optional, array of strings
  "recipeCuisine": ["tex-mex"],                    // optional, array of strings
  "keywords": ["chili", "beef"],                   // optional, array of strings
  "notes": "Better the next day.",                 // optional, freeform
  "visibility": "draft"                            // optional: "public" | "draft"
}
```

Durations are ISO 8601 (`PT20M` = 20 min, `PT1H30M` = 90 min). The server
generates the slug from `name`; never set an id or slug. For an `update` patch,
include only the fields you want to change.
