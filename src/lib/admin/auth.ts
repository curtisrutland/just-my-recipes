import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

/**
 * Owner gate for the admin surface.
 *
 * `src/proxy.ts` already makes `clerkMiddleware` redirect *unauthenticated*
 * requests on `/admin` to sign-in, but that only proves "some Clerk user is
 * signed in" — NOT that it's the owner. This is the real authorization check:
 * the signed-in Clerk user id must equal `CLERK_ALLOWED_USER_ID` (the same
 * single-user allowlist the MCP route uses). Called independently by every
 * admin page/layout and (later) every admin server action — the middleware
 * redirect is a convenience, this is the boundary.
 */
export async function getOwnerUserId(): Promise<string | null> {
  const { userId } = await auth();
  const allowed = process.env.CLERK_ALLOWED_USER_ID;
  if (!userId || !allowed || userId !== allowed) return null;
  return userId;
}

/**
 * Assert the current request is the owner, or 404. A signed-in non-owner gets a
 * plain not-found (the admin surface simply doesn't exist for them) rather than
 * a hint that they're one allowlist entry away from access.
 */
export async function requireOwner(): Promise<string> {
  const userId = await getOwnerUserId();
  if (!userId) notFound();
  return userId;
}

/**
 * Owner assertion for **server actions**. Fails closed by throwing (a rejected
 * action) rather than `notFound()`, which is a rendering concern. Every admin
 * mutation calls this first, independent of the middleware redirect and the
 * page-level gate — a crafted POST to an action must still be the owner.
 */
export async function assertOwner(): Promise<string> {
  const userId = await getOwnerUserId();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}
