import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandlerClerk,
} from "@clerk/mcp-tools/next";
import { connection } from "next/server";

// RFC 9728 requires the protected-resource metadata for the resource at
// `/api/mcp` to live at this PATH-SPECIFIC well-known URL (not just the root).
// Served here, the handler derives `resource: https://<host>/api/mcp` by
// stripping the `/.well-known/oauth-protected-resource` prefix — which is the
// value claude.ai's session-binding expects to match. The root route stays as a
// fallback for clients that probe it.
const clerkHandler = protectedResourceHandlerClerk();
const corsHandler = metadataCorsOptionsRequestHandler();

export async function GET(req: Request) {
  await connection();
  return clerkHandler(req);
}

export { corsHandler as OPTIONS };
