/**
 * Schema-level integration tests for the users table.
 *
 * These tests require a real Postgres database to run.
 * Set TEST_DATABASE_URL in your .env (or CI environment) to a separate
 * test database so seed data is isolated from development data.
 *
 * Run: pnpm test (jest will pick this up via testMatch: **\/__tests__\/**\/*.test.ts)
 *
 * The test database must have migrations applied before these run:
 *   DATABASE_URL=$TEST_DATABASE_URL pnpm drizzle:push
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../auth.schema";
import * as dotenv from "dotenv";

dotenv.config();

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

if (!TEST_DB_URL) {
  throw new Error(
    "TEST_DATABASE_URL (or DATABASE_URL) must be set to run schema tests.",
  );
}

const pool = new Pool({ connectionString: TEST_DB_URL });
const db = drizzle({ client: pool });

describe("Users schema constraints", () => {
  beforeAll(async () => {
    // Clean the users table before the suite runs so tests are deterministic.
    // FK cascade will also clear posts/comments/likes referencing these users.
    await db.delete(users);
  });

  afterAll(async () => {
    await db.delete(users);
    await pool.end();
  });

  it("inserts a valid user successfully", async () => {
    const [inserted] = await db
      .insert(users)
      .values({
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@test.com",
        passwordHash: "some_bcrypt_hash",
      })
      .returning();

    expect(inserted.id).toBeDefined();
    expect(inserted.email).toBe("ada@test.com");
    expect(inserted.createdAt).toBeInstanceOf(Date);
  });

  it("enforces the unique email constraint", async () => {
    await db.insert(users).values({
      firstName: "Duplicate",
      lastName: "User",
      email: "unique@test.com",
      passwordHash: "hash",
    });

    // Second insert with the same email must throw a PG unique_violation (23505)
    await expect(
      db.insert(users).values({
        firstName: "Another",
        lastName: "User",
        email: "unique@test.com",
        passwordHash: "hash",
      }),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects an insert missing required fields (not-null constraint)", async () => {
    // @ts-expect-error — intentionally omitting required fields for the test
    await expect(db.insert(users).values({ email: "missing@test.com" })).rejects.toThrow();
  });

  it("stores the correct firstName and lastName", async () => {
    const [row] = await db
      .insert(users)
      .values({
        firstName: "Grace",
        lastName: "Hopper",
        email: "grace@test.com",
        passwordHash: "hash",
      })
      .returning();

    expect(row.firstName).toBe("Grace");
    expect(row.lastName).toBe("Hopper");
  });
});
