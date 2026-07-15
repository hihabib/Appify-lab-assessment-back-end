/**
 * Centralized schema registry.
 *
 * Drizzle Kit reads this file (via drizzle.config.ts) to discover all tables,
 * enums, and relations for migration generation.
 *
 * The `db` instance in db.ts also imports this so that typed relational
 * queries (db.query.*) are available across the application.
 *
 * Add new module schemas here as they are introduced in later parts.
 */
export * from "../modules/auth/auth.schema";
export * from "../modules/feed/feed.schema";
