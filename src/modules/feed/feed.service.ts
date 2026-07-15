import { eq, desc, lt, and, sql, isNull } from "drizzle-orm";
import { db } from "../../config/db";
import { posts, comments } from "./feed.schema";
import { users } from "../auth/auth.schema";
import { AppError } from "../../shared/middlewares/errorHandler";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedPostUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedPostReactor {
  id: string;
  firstName: string;
  lastName: string;
}

export interface FeedPost {
  id: string;
  userId: string;
  content: string | null;
  imageUrl: string | null;
  visibility: "public" | "private";
  createdAt: Date;
  user: FeedPostUser | null;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  myReactionType: string | null;
  topReactors: FeedPostReactor[] | null;
}

export interface CreatePostOptions {
  userId: string;
  content?: string;
  imageUrl?: string | null;
  visibility?: "public" | "private";
}

export interface GetFeedPostsOptions {
  /** Maximum number of posts to return (capped at 50). Defaults to 10. */
  limit?: number;
  /**
   * Cursor for keyset pagination — ISO 8601 string of the `createdAt`
   * value of the last item from the previous page.
   * Omit to fetch the first page.
   */
  cursor?: string;
  /**
   * The authenticated user's ID — used to compute `isLikedByMe` per post.
   * When provided, an EXISTS subquery is added; otherwise defaults to false.
   */
  currentUserId?: string;
}

export interface FeedResponse {
  posts: FeedPost[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class FeedService {
  /**
   * Returns public posts ordered by createdAt DESC with user info, like count,
   * and comment count. Uses keyset (cursor) pagination for efficient deep pages.
   *
   * Visibility rule: only `public` posts appear in the general feed.
   * (Private posts visible to their author only — enforced in a later part.)
   */
  static async getFeedPosts(options: GetFeedPostsOptions = {}): Promise<FeedResponse> {
    const limit = Math.min(options.limit ?? 10, 50);

    // Visibility rule:
    //   - public posts  → visible to everyone
    //   - private posts → visible only to their author (currentUserId)
    const visibilityClause = options.currentUserId
      ? sql<boolean>`(${posts.visibility} = 'public' OR (${posts.visibility} = 'private' AND ${posts.userId} = ${options.currentUserId}))`
      : eq(posts.visibility, "public");

    // Build where clause: apply visibility filter; optionally apply cursor
    const whereClause = options.cursor
      ? and(visibilityClause, lt(posts.createdAt, new Date(options.cursor)))
      : visibilityClause;

    // Fetch limit + 1 to determine whether a next page exists
    const rows = await db
      .select({
        id: posts.id,
        userId: posts.userId,
        content: posts.content,
        imageUrl: posts.imageUrl,
        visibility: posts.visibility,
        createdAt: posts.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        likeCount: sql<number>`(
          SELECT COUNT(*)::int FROM likes
          WHERE likes.entity_type = 'post' AND likes.entity_id = ${posts.id}
        )`.as("like_count"),
        commentCount: sql<number>`(
          SELECT COUNT(*)::int FROM comments
          WHERE comments.post_id = ${posts.id}
        )`.as("comment_count"),
        isLikedByMe: options.currentUserId
          ? sql<boolean>`EXISTS (
              SELECT 1 FROM likes
              WHERE likes.entity_type = 'post'
              AND likes.entity_id = ${posts.id}
              AND likes.user_id = ${options.currentUserId}
            )`.as("is_liked_by_me")
          : sql<boolean>`false`.as("is_liked_by_me"),
        myReactionType: options.currentUserId
          ? sql<string | null>`(
              SELECT likes.reaction_type FROM likes
              WHERE likes.entity_type = 'post'
              AND likes.entity_id = ${posts.id}
              AND likes.user_id = ${options.currentUserId}
              LIMIT 1
            )`.as("my_reaction_type")
          : sql<null>`NULL`.as("my_reaction_type"),
        topReactors: sql<FeedPostReactor[] | null>`(
          SELECT json_agg(json_build_object(
            'id', r.id,
            'firstName', r.first_name,
            'lastName', r.last_name
          ))
          FROM (
            SELECT u.id, u.first_name, u.last_name
            FROM likes l
            JOIN users u ON u.id = l.user_id
            WHERE l.entity_type = 'post'
            AND l.entity_id = ${posts.id}
            ORDER BY l.created_at DESC
            LIMIT 5
          ) r
        )`.as("top_reactors"),
      })
      .from(posts)
      .leftJoin(users, eq(posts.userId, users.id))
      .where(whereClause)
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;
    const data = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage
      ? data[data.length - 1].createdAt.toISOString()
      : null;

    return {
      posts: data as FeedPost[],
      nextCursor,
      hasNextPage,
    };
  }

  // ── Comment helpers ────────────────────────────────────────────────────────

  /**
   * Returns top-level comments (parentId IS NULL) for a post, ordered
   * newest-first, with the author's profile joined in.
   */
  static async getTopLevelComments(
    postId: string,
    limit = 10,
    offset = 0,
    userId?: string,
  ) {
    return db
      .select({
        id: comments.id,
        postId: comments.postId,
        userId: comments.userId,
        parentId: comments.parentId,
        content: comments.content,
        createdAt: comments.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        likeCount: sql<number>`(
          SELECT COUNT(*)::int FROM likes
          WHERE likes.entity_type = 'comment' AND likes.entity_id = ${comments.id}
        )`.as("like_count"),
        isLikedByMe: userId
          ? sql<boolean>`EXISTS (
              SELECT 1 FROM likes
              WHERE likes.entity_type = 'comment'
              AND likes.entity_id = ${comments.id}
              AND likes.user_id = ${userId}
            )`.as("is_liked_by_me")
          : sql<boolean>`false`.as("is_liked_by_me"),
        myReactionType: userId
          ? sql<string | null>`(
              SELECT likes.reaction_type FROM likes
              WHERE likes.entity_type = 'comment'
              AND likes.entity_id = ${comments.id}
              AND likes.user_id = ${userId}
              LIMIT 1
            )`.as("my_reaction_type")
          : sql<null>`NULL`.as("my_reaction_type"),
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(
        and(
          eq(comments.postId, postId),
          isNull(comments.parentId), // Level 1 only
        ),
      )
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Inserts a top-level comment and returns it with author info populated,
   * ready for the frontend to prepend to the comment list.
   */
  /**
   * Fetches direct replies (parentId = commentId) for a single comment.
   */
  static async getReplies(commentId: string, limit = 10, offset = 0, userId?: string) {
    return db
      .select({
        id: comments.id,
        postId: comments.postId,
        userId: comments.userId,
        parentId: comments.parentId,
        content: comments.content,
        createdAt: comments.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        likeCount: sql<number>`(
          SELECT COUNT(*)::int FROM likes
          WHERE likes.entity_type = 'comment' AND likes.entity_id = ${comments.id}
        )`.as("like_count"),
        isLikedByMe: userId
          ? sql<boolean>`EXISTS (
              SELECT 1 FROM likes
              WHERE likes.entity_type = 'comment'
              AND likes.entity_id = ${comments.id}
              AND likes.user_id = ${userId}
            )`.as("is_liked_by_me")
          : sql<boolean>`false`.as("is_liked_by_me"),
        myReactionType: userId
          ? sql<string | null>`(
              SELECT likes.reaction_type FROM likes
              WHERE likes.entity_type = 'comment'
              AND likes.entity_id = ${comments.id}
              AND likes.user_id = ${userId}
              LIMIT 1
            )`.as("my_reaction_type")
          : sql<null>`NULL`.as("my_reaction_type"),
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.parentId, commentId))
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Inserts a comment (top-level when parentId is omitted, reply otherwise)
   * and returns it with author info populated.
   */
  static async addComment(
    postId: string,
    userId: string,
    content: string,
    parentId?: string,
  ) {
    // If a parentId is provided, verify it belongs to the same post.
    // This prevents cross-post reply injection.
    if (parentId) {
      const [parentComment] = await db
        .select({ id: comments.id, postId: comments.postId })
        .from(comments)
        .where(eq(comments.id, parentId))
        .limit(1);

      if (!parentComment) {
        throw new AppError("Parent comment not found.", 404);
      }
      if (parentComment.postId !== postId) {
        throw new AppError("Parent comment does not belong to this post.", 400);
      }
    }

    const [newComment] = await db
      .insert(comments)
      .values({ postId, userId, content, parentId: parentId ?? null })
      .returning();

    const [populated] = await db
      .select({
        id: comments.id,
        postId: comments.postId,
        userId: comments.userId,
        parentId: comments.parentId,
        content: comments.content,
        createdAt: comments.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.id, newComment.id));

    return { ...populated, likeCount: 0, isLikedByMe: false, myReactionType: null };
  }

  /**
   * Creates a new post and returns it with author info and zeroed counts.
   * likeCount / commentCount are 0 at creation time — no DB subquery needed.
   */
  static async createPost(options: CreatePostOptions): Promise<FeedPost> {
    const { userId, content, imageUrl, visibility } = options;

    const [newPost] = await db
      .insert(posts)
      .values({
        userId,
        content: content ?? null,
        imageUrl: imageUrl ?? null,
        visibility: visibility ?? "public",
      })
      .returning();

    // Join user info for the response
    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    return {
      ...newPost,
      user: user ?? null,
      likeCount: 0,
      commentCount: 0,
      isLikedByMe: false,
      myReactionType: null,
      topReactors: null,
    };
  }
}
