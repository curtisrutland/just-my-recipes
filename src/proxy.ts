import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renamed Middleware → Proxy (same mechanism). Clerk's middleware
// runs here so `auth()` works inside the MCP route and the admin surface.
//
// The MCP endpoint gates itself via `withMcpAuth` and the /.well-known/* routes
// stay public, so we only actively protect `/admin`: unauthenticated requests
// are redirected to sign-in here. This is only an authentication gate — the
// OWNER check (allowlist) lives in `requireOwner()`, re-run in every admin
// page/action (see src/lib/admin/auth.ts).
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) await auth.protect();
});

// Scope Clerk to ONLY the admin + MCP surfaces. The public recipe site and the
// existing static-key API (/api/recipes) never touch Clerk, so a Clerk misconfig
// or outage can break the connector or admin but never the public site itself.
export const config = {
  matcher: [
    "/admin(.*)",
    "/api/mcp",
    "/api/sse",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/api/mcp",
    "/.well-known/oauth-authorization-server",
  ],
};
