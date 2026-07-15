/**
 * Seed script for Buddy Script — Part 2.
 *
 * Populates: users → posts → comments (+ replies) → likes
 *
 * Run:  pnpm db:seed
 * Prerequisite: migrations must be applied first:
 *   pnpm drizzle:generate   (generate SQL migration files)
 *   pnpm drizzle:migrate    (apply migrations to the DB)
 *
 * WARNING: This script clears existing seed data before inserting.
 * Do NOT run against production.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import * as dotenv from "dotenv";
import * as schema from "../src/config/schema";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check your .env file.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

async function main(): Promise<void> {
  console.log("🌱  Seeding database...");

  // ── 0. Clean slate (order matters due to FK constraints) ──────────────────
  await db.delete(schema.likes);
  await db.delete(schema.comments);
  await db.delete(schema.posts);
  await db.delete(schema.users);
  console.log("🗑️   Cleared existing seed data.");

  // ── 1. Users ──────────────────────────────────────────────────────────────
  const [steveHash, billHash] = await Promise.all([
    bcrypt.hash("password123", 10),
    bcrypt.hash("password123", 10),
  ]);

  const [user1, user2] = await db
    .insert(schema.users)
    .values([
      {
        firstName: "Steve",
        lastName: "Jobs",
        email: "steve@apple.com",
        passwordHash: steveHash,
      },
      {
        firstName: "Bill",
        lastName: "Gates",
        email: "bill@microsoft.com",
        passwordHash: billHash,
      },
    ])
    .returning();

  console.log(`👤  Created users: ${user1.email}, ${user2.email}`);

  // ── 2. Posts ──────────────────────────────────────────────────────────────
  const [post1, post2] = await db
    .insert(schema.posts)
    .values([
      {
        userId: user1.id,
        content: "Excited to announce the new iPhone! Truly magical.",
        visibility: "public",
      },
      {
        userId: user2.id,
        content: "Windows 12 is coming along nicely. Exciting times ahead.",
        visibility: "public",
      },
    ])
    .returning();

  console.log(`📝  Created posts: ${post1.id}, ${post2.id}`);

  // ── 3. Comments & Replies ─────────────────────────────────────────────────
  // Top-level comment on post1
  const [comment1] = await db
    .insert(schema.comments)
    .values([
      {
        postId: post1.id,
        userId: user2.id,
        content: "Looks great Steve! Can't wait to try it.",
      },
    ])
    .returning();

  // Reply to comment1 (nested — parentId set)
  await db.insert(schema.comments).values([
    {
      postId: post1.id,
      userId: user1.id,
      parentId: comment1.id,
      content: "Thanks Bill! You're going to love it.",
    },
  ]);

  // Top-level comment on post2
  const [comment2] = await db
    .insert(schema.comments)
    .values([
      {
        postId: post2.id,
        userId: user1.id,
        content: "Sounds promising. Will there be a dark mode from day one?",
      },
    ])
    .returning();

  console.log(
    `💬  Created comments: top-level(${comment1.id}), reply, top-level(${comment2.id})`,
  );

  // ── 4. Likes ──────────────────────────────────────────────────────────────
  await db.insert(schema.likes).values([
    // Bill likes Steve's post
    { userId: user2.id, entityType: "post", entityId: post1.id },
    // Steve likes Bill's post
    { userId: user1.id, entityType: "post", entityId: post2.id },
    // Steve likes Bill's comment on post1
    { userId: user1.id, entityType: "comment", entityId: comment1.id },
    // Bill likes Steve's comment on post2
    { userId: user2.id, entityType: "comment", entityId: comment2.id },
  ]);

  console.log("❤️   Created 4 likes (posts + comments).");

  console.log("✅  Seeding complete!");
}

main()
  .catch((err) => {
    console.error("❌  Seeding failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
