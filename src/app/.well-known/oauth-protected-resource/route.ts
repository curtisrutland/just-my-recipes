import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandlerClerk,
} from "@clerk/mcp-tools/next";
import { connection } from "next/server";

// RFC 9728 Protected Resource Metadata. Advertises Clerk as our authorization
// server so claude.ai knows where to run the OAuth flow. Public + CORS-enabled
// (browser-based MCP clients preflight it).
const clerkHandler = protectedResourceHandlerClerk();
const corsHandler = metadataCorsOptionsRequestHandler();

// `connection()` marks this dynamic (runtime) under Cache Components — OAuth
// metadata depends on runtime Clerk config and must not be prerendered.
export async function GET(req: Request) {
  await connection();
  return clerkHandler(req);
}

export { corsHandler as OPTIONS };
