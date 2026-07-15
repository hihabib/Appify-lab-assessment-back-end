import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
  foreignKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { users } from "../auth/auth.schema";

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * Post visibility: public posts appear in everyone's feed;
 * private posts are visible only to the author (enforced in Part 4).
 */
export const visibilityEnum = pgEnum("visibility", ["public", "private"]);

/**
 * Discriminator for the polymorphic likes table.
 * Tells us whether a like targets a post or a comment.
 */
export const entityTypeEnum = pgEnum("entity_type", ["post", "comment"]);

// ─── Posts ────────────────────────────────────────────────────────────────────

/**
 * Posts table.
 * A post belongs to a user and can have text content and/or an image.
 * Indexed by createdAt (DESC for feed) and userId (for profile pages).
 */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content"),
    imageUrl: text("image_url"),
    visibility: visibilityEnum("visibility").default("public").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Primary feed query: ORDER BY created_at DESC
    index("post_created_at_idx").on(table.createdAt),
    // Profile / author filtering
    index("post_user_id_idx").on(table.userId),
  ],
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

// ─── Comments ─────────────────────────────────────────────────────────────────

/**
 * Comments table — Adjacency List pattern for hierarchical replies.
 *
 * - parentId = NULL  →  top-level comment on a post
 * - parentId = <id>  →  reply to another comment
 *
 * The self-referencing FK is declared via the standalone `foreignKey()`
 * operator (required by TypeScript for circular references).
 */
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Self-reference — type annotation required to avoid circular TS inference
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => comments.id,
      { onDelete: "cascade" },
    ),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Fetch all comments for a post
    index("comment_post_id_idx").on(table.postId),
    // Fetch all replies to a given comment
    index("comment_parent_id_idx").on(table.parentId),
    // Named FK constraint for self-reference (also declared inline above)
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "comments_parent_id_fk",
    }).onDelete("cascade"),
  ],
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

// ─── Likes ────────────────────────────────────────────────────────────────────

/**
 * Likes table — polymorphic via the entity_type enum.
 *
 * A single user cannot like the same entity more than once:
 * enforced by the composite unique index (userId + entityType + entityId).
 *
 * entityId is not a typed FK because it references two different tables
 * (posts or comments). Application code must validate the target exists
 * before inserting a like.
 */
/**
 * Valid reaction types — mirrors the 6 Facebook-style reactions.
 */
export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";
export const REACTION_TYPES: ReactionType[] = ["like", "love", "haha", "wow", "sad", "angry"];

export const likes = pgTable(
  "likes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    reactionType: text("reaction_type").default("like").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Prevent double-likes; also serves as the lookup index for "did I like this?"
    uniqueIndex("unique_user_like_idx").on(
      table.userId,
      table.entityType,
      table.entityId,
    ),
    // Count / fetch likes by entity (e.g., "all likes on post X")
    index("like_entity_idx").on(table.entityType, table.entityId),
  ],
);

export type Like = typeof likes.$inferSelect;
export type NewLike = typeof likes.$inferInsert;
