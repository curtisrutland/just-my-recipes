import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison independent of input length: compare fixed-length
 * SHA-256 digests so neither the length nor the content of the provided key
 * leaks through timing.
 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Extract the `Authorization: Bearer <token>` value, or null. */
function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

/**
 * True iff the request carries a valid write token: either `RECIPES_API_KEY`
 * (full key) or `RECIPES_PUBLISH_TOKEN` (a separate, independently-revocable
 * token used by the claude.ai recipes Skill). Grants create/update/read-drafts.
 */
export function isAuthorized(request: Request): boolean {
  const provided = bearerToken(request);
  if (provided == null) return false;
  const accepted = [
    process.env.RECIPES_API_KEY,
    process.env.RECIPES_PUBLISH_TOKEN,
  ].filter((k): k is string => Boolean(k));
  return accepted.some((k) => safeEqual(provided, k));
}

/**
 * True iff the request carries the **primary** `RECIPES_API_KEY` only. Used to
 * gate destructive operations (hard delete): the Skill's publish token is
 * intentionally rejected here, so permanent deletion requires the owner's key.
 */
export function isPrimaryKey(request: Request): boolean {
  const provided = bearerToken(request);
  const expected = process.env.RECIPES_API_KEY;
  if (provided == null || !expected) return false;
  return safeEqual(provided, expected);
}
