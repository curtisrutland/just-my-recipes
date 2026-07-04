import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandlerClerk,
} from "@clerk/mcp-tools/next";
import { connection } from "next/server";

// RFC 9728 path-specific protected-resource metadata for the `/api/mcp` endpoint.
// The Clerk handler otherwise hardcodes `resource` to the origin; per RFC 9728 the
// client verifies `resource` equals the endpoint it's calling, so we override it
// to `<origin>/api/mcp` (derived per-request so it's correct on localhost + prod).
// `properties` is merged last in the handler, so this wins.
const corsHandler = metadataCorsOptionsRequestHandler();

export async function GET(req: Request) {
  await connection();
  const origin = new URL(req.url).origin;
  return protectedResourceHandlerClerk({ resource: `${origin}/api/mcp` })(req);
}

export { corsHandler as OPTIONS };
