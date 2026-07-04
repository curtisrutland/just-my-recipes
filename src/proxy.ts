import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed Middleware → Proxy (same mechanism). Clerk's middleware
// runs here so `auth({ acceptsToken: "oauth_token" })` works inside the MCP
// route. It does NOT protect any routes by default — the MCP endpoint gates
// itself via `withMcpAuth`, and the /.well-known/* metadata routes stay public.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next internals and static assets; run on everything else...
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // ...and always run on API routes (the MCP transport lives under /api).
    "/(api|trpc)(.*)",
  ],
};
