import { authServerMetadataHandlerClerk } from "@clerk/mcp-tools/next";
import { connection } from "next/server";

// RFC 8414 Authorization Server Metadata, proxied from Clerk. Some MCP clients
// look for AS metadata on the resource origin; this serves it from ours.
const clerkHandler = authServerMetadataHandlerClerk();

// Under Cache Components, `connection()` marks this dynamic (runtime) so it is
// never prerendered — OAuth metadata depends on runtime Clerk config.
export async function GET() {
  await connection();
  return clerkHandler();
}
