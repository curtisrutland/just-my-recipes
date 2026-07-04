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

/**
 * True iff the request carries `Authorization: Bearer <token>` where token is
 * either `RECIPES_API_KEY` (full API key) or `RECIPES_PUBLISH_TOKEN` (a separate,
 * independently-revocable token used by the claude.ai "publish recipe" Skill, so
 * a leak there can be rotated without touching the main key).
 */
export function isAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const accepted = [
    process.env.RECIPES_API_KEY,
    process.env.RECIPES_PUBLISH_TOKEN,
  ].filter((k): k is string => Boolean(k));
  return accepted.some((k) => safeEqual(provided, k));
}
