import { auth } from "@clerk/nextjs/server";
import { verifyClerkToken } from "@clerk/mcp-tools/next";

/**
 * Token verifier for the MCP endpoint (passed to `withMcpAuth`).
 *
 * Clerk is the OAuth authorization server; we are the resource server. This
 * validates the incoming bearer token via Clerk, then enforces the single-user
 * rule: only `CLERK_ALLOWED_USER_ID` may use the connector. Returning
 * `undefined` makes `withMcpAuth` respond 401, so a valid-but-unauthorized
 * Clerk user is rejected exactly like an anonymous one.
 */
export async function verifyToken(_req: Request, token?: string) {
  const clerkAuth = await auth({ acceptsToken: "oauth_token" });
  const authInfo = verifyClerkToken(clerkAuth, token);
  if (!authInfo) return undefined;

  const allowed = process.env.CLERK_ALLOWED_USER_ID;
  const userId = authInfo.extra?.userId as string | undefined;
  if (!allowed || !userId || userId !== allowed) return undefined;

  return authInfo;
}
