---
name: publish-recipe
description: >-
  Publish a recipe to the user's site justmy.recipes. Use whenever the user wants
  to add, publish, save, or push a recipe to their site (e.g. "add this to my
  recipes", "publish this to justmy.recipes"). Requires code execution with
  network egress allowed for justmy.recipes.
---

# Publish a recipe to justmy.recipes

This skill publishes a recipe to the user's personal recipe site via its REST API.

## How to use it

1. Gather the recipe from the conversation and build a JSON object matching the
   **schema** below. `name` and at least one `recipeIngredient` are required;
   everything else is optional.
2. Write that JSON to a file, e.g. `recipe.json`.
3. Run the bundled script:
   ```bash
   python publish_recipe.py recipe.json
   ```
4. The script prints the published URL. Report it to the user. If it prints a
   validation error, fix the JSON and retry.

Default `visibility` to `"draft"` unless the user explicitly says to publish it
publicly — drafts are saved but hidden from the public site until promoted.

## Recipe JSON schema

```jsonc
{
  "name": "Chili con Carne",            // required, string
  "recipeIngredient": [                  // required, array of strings, >=1
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

Durations use ISO 8601 (`PT20M` = 20 minutes, `PT1H30M` = 90 minutes). The
server generates the slug from `name`; do not set an id or slug.
