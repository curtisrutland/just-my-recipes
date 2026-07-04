import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { RecipeJsonLd } from "@/lib/recipe";

/**
 * Single owner in v1, but the users table (and the FK below) exists from day
 * one because multi-publisher is a planned v2 direction.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const visibilityEnum = pgEnum("visibility", ["public", "draft"]);

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  // Generated from `name` on create; immutable afterwards.
  slug: text("slug").notNull().unique(),
  // `title` and `tags` are denormalized from the JSONB on write (server-side)
  // so index/tag queries never have to parse JSONB.
  title: text("title").notNull(),
  tags: text("tags").array().notNull().default([]),
  visibility: visibilityEnum("visibility").notNull().default("draft"),
  data: jsonb("data").$type<RecipeJsonLd>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // FULL-TEXT SEARCH — out of scope for v1. When added, a generated tsvector
  // column would live here, e.g.:
  //   searchVector: tsvector("search_vector").generatedAlwaysAs(
  //     sql`to_tsvector('english', title || ' ' || coalesce(data->>'description',''))`,
  //   ),
  // plus a GIN index on it.
});

export type UserRow = typeof users.$inferSelect;
export type RecipeRow = typeof recipes.$inferSelect;
export type NewRecipeRow = typeof recipes.$inferInsert;
