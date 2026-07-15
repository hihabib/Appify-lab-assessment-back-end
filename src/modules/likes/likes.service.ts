import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../config/db";
import { likes, type ReactionType } from "../feed/feed.schema";
import { users } from "../auth/auth.schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EntityType = "post" | "comment";

export interface ToggleLikeResult {
  action: "liked" | "unliked" | "changed";
  entityType: EntityType;
  entityId: string;
  reactionType: ReactionType;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class LikesService {
  /**
   * Toggles or changes a reaction on any entity (post or comment).
   *
   * Logic:
   *   - No existing reaction → insert with given reactionType ("liked")
   *   - Same reactionType already present → delete ("unliked" / toggle off)
   *   - Different reactionType already present → update to new type ("changed")
   *
   * The composite unique index on (userId, entityType, entityId) prevents
   * duplicate rows at the DB level.
   */
  static async toggleLike(
    userId: string,
    entityType: EntityType,
    entityId: string,
    reactionType: ReactionType = "like",
  ): Promise<ToggleLikeResult> {
    const [existing] = await db
      .select({ id: likes.id, reactionType: likes.reactionType })
      .from(likes)
      .where(
        and(
          eq(likes.userId, userId),
          eq(likes.entityType, entityType),
          eq(likes.entityId, entityId),
        ),
      )
      .limit(1);

    // Toggle off: same reaction clicked again
    if (existing && existing.reactionType === reactionType) {
      await db.delete(likes).where(eq(likes.id, existing.id));
      return { action: "unliked", entityType, entityId, reactionType };
    }

    // Change reaction: different type selected
    if (existing) {
      await db
        .update(likes)
        .set({ reactionType })
        .where(eq(likes.id, existing.id));
      return { action: "changed", entityType, entityId, reactionType };
    }

    // New reaction
    await db.insert(likes).values({ userId, entityType, entityId, reactionType });
    return { action: "liked", entityType, entityId, reactionType };
  }

  /**
   * Returns the total number of reactions for any entity.
   */
  static async getLikeCount(
    entityType: EntityType,
    entityId: string,
  ): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(likes)
      .where(
        and(
          eq(likes.entityType, entityType),
          eq(likes.entityId, entityId),
        ),
      );
    return row?.count ?? 0;
  }

  /**
   * Returns a paginated list of users who reacted to a given entity,
   * with their reactionType included.
   */
  static async getLikers(
    entityType: EntityType,
    entityId: string,
    page = 1,
    limit = 20,
  ) {
    const offset = (page - 1) * limit;

    return db
      .select({
        likeId: likes.id,
        reactionType: likes.reactionType,
        createdAt: likes.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(likes)
      .innerJoin(users, eq(likes.userId, users.id))
      .where(
        and(
          eq(likes.entityType, entityType),
          eq(likes.entityId, entityId),
        ),
      )
      .orderBy(desc(likes.createdAt))
      .limit(limit)
      .offset(offset);
  }
}
