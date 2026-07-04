import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyToken } from "@/lib/mcp/auth";
import { registerRecipeTools } from "@/lib/mcp/tools";

// Streamable-HTTP MCP endpoint. `[transport]` resolves to /api/mcp (and /api/sse).
// Stateless (no Redis) — fine for claude.ai's streamable HTTP transport.
const handler = createMcpHandler(
  (server) => {
    registerRecipeTools(server);
  },
  { serverInfo: { name: "no-bs-recipes", version: "1.0.0" } },
  { basePath: "/api", maxDuration: 60 },
);

// Require a valid Clerk OAuth token (and pass the single-user allowlist).
// On failure this returns 401 + WWW-Authenticate pointing at the metadata doc,
// which is exactly what claude.ai's connector flow expects.
const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST };

export const maxDuration = 60;
