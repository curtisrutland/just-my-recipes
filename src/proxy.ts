import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed Middleware → Proxy (same mechanism). Clerk's middleware
// runs here so `auth({ acceptsToken: "oauth_token" })` works inside the MCP
// route. It does NOT protect any routes by default — the MCP endpoint gates
// itself via `withMcpAuth`, and the /.well-known/* metadata routes stay public.
export default clerkMiddleware();

// Scope Clerk to ONLY the MCP surface. The public recipe site and the existing
// static-key API (/api/recipes) never touch Clerk, so a Clerk misconfig or
// outage can break the connector but never the site itself.
export const config = {
  matcher: [
    "/api/mcp",
    "/api/sse",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/api/mcp",
    "/.well-known/oauth-authorization-server",
  ],
};
