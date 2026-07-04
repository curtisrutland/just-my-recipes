import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Neon serverless HTTP driver — stateless, ideal for Vercel functions and
// build-time prerendering. See Drizzle `neon-http`.
const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
export { schema };
