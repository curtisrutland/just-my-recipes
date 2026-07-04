#!/usr/bin/env python3
"""Publish a recipe to justmy.recipes via its REST API.

Usage:  python publish_recipe.py recipe.json
Reads a recipe JSON file (schema in SKILL.md), POSTs it to the site, prints the
published URL. Uses only the Python standard library (no pip install needed).
"""
import json
import sys
import urllib.error
import urllib.request

API_URL = "https://justmy.recipes/api/recipes"

# Paste your RECIPES_PUBLISH_TOKEN here (revocable; only allows creating recipes
# on your own site). Do NOT commit the real token to a public repo.
PUBLISH_TOKEN = "PASTE_YOUR_PUBLISH_TOKEN_HERE"


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: python publish_recipe.py <recipe.json>", file=sys.stderr)
        return 2

    with open(sys.argv[1], "rb") as f:
        payload = f.read()

    req = urllib.request.Request(
        API_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {PUBLISH_TOKEN}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req) as resp:
            body = json.load(resp)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")
        print(f"Publish failed ({e.code}): {detail}", file=sys.stderr)
        return 1

    slug = body.get("slug")
    print(f"Published: https://justmy.recipes/recipes/{slug}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
