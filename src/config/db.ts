import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as schema from "./schema";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check your .env file.");
}

/**
 * PostgreSQL connection pool.
 * Pool settings are tuned for high-throughput: the application is designed
 * to handle millions of reads, so max connections are set generously.
 * Adjust max to match your Postgres server's max_connections setting.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/**
 * Drizzle ORM instance.
 *
 * Passing `schema` enables the typed relational query API (db.query.*).
 * The modern drizzle-orm node-postgres API uses { client: pool } syntax.
 */
export const db = drizzle({ client: pool, schema });

/**
 * Verify the database connection at startup.
 * Call this in server.ts before app.listen().
 */
export async function connectDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    console.log("PostgreSQL connected successfully.");
  } finally {
    client.release();
  }
}
