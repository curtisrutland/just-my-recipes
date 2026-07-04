/** Canonical base URL for the site. Used in metadata and JSON-LD `url` fields. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "Just My Recipes";
