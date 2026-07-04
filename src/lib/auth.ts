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

/** True iff the request carries `Authorization: Bearer <RECIPES_API_KEY>`. */
export function isAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const expected = process.env.RECIPES_API_KEY;
  if (!expected) return false;
  return safeEqual(provided, expected);
}
