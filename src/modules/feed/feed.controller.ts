import type { Request, Response, NextFunction } from "express";
import { FeedService } from "./feed.service";
import type { AuthenticatedRequest } from "../../shared/middlewares/authenticate";

export class FeedController {
  /**
   * GET /api/posts
   *
   * Query params:
   *   limit  — number of posts per page (default 10, max 50)
   *   cursor — ISO 8601 createdAt of the last item on the previous page
   *
   * Response:
   *   { success: true, data: Post[], meta: { hasNextPage, nextCursor } }
   */
  static async getPosts(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const cursor = (req.query.cursor as string) || undefined;
      const currentUserId = (req as AuthenticatedRequest).userId;

      const result = await FeedService.getFeedPosts({ limit, cursor, currentUserId });

      res.status(200).json({
        success: true,
        data: result.posts,
        meta: {
          hasNextPage: result.hasNextPage,
          nextCursor: result.nextCursor,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/posts/:postId/comments
   *
   * Query params:
   *   page  — 1-based page number (default 1)
   *   limit — comments per page (default 10, max 50)
   *
   * Response:
   *   { success: true, data: Comment[], meta: { page, limit } }
   */
  static async getComments(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const postId = req.params.postId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const offset = (page - 1) * limit;

      const userId = (req as AuthenticatedRequest).userId;
      const data = await FeedService.getTopLevelComments(postId, limit, offset, userId);

      res.status(200).json({ success: true, data, meta: { page, limit } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/posts/:postId/comments
   *
   * Body (JSON):
   *   content — comment text (required)
   *
   * Response:
   *   201  { success: true, data: Comment }
   */
  static async addComment(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const postId = req.params.postId as string;
      const { content, parentId } = req.body as {
        content?: string;
        parentId?: string;
      };

      if (!content?.trim()) {
        res.status(400).json({
          success: false,
          message: "Comment content is required.",
        });
        return;
      }

      const newComment = await FeedService.addComment(
        postId,
        userId,
        content.trim(),
        parentId,
      );

      res.status(201).json({ success: true, data: newComment });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/posts/comments/:commentId/replies
   *
   * Query params:
   *   page  — 1-based page number (default 1)
   *   limit — replies per page (default 10, max 50)
   *
   * Response:
   *   { success: true, data: Comment[], meta: { page, limit } }
   */
  static async getReplies(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const commentId = req.params.commentId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const offset = (page - 1) * limit;

      const userId = (req as AuthenticatedRequest).userId;
      const data = await FeedService.getReplies(commentId, limit, offset, userId);

      res.status(200).json({ success: true, data, meta: { page, limit } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/posts
   *
   * Body (multipart/form-data):
   *   content  — post text (optional if image is provided)
   *   image    — image file (optional, processed by Multer before this handler)
   *
   * Response:
   *   201  { success: true, data: FeedPost }
   */
  static async createPost(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const content = (req.body.content as string | undefined) || undefined;
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const rawVisibility = req.body.visibility as string | undefined;
      const visibility: "public" | "private" =
        rawVisibility === "private" ? "private" : "public";

      if (!content && !imageUrl) {
        res.status(400).json({
          success: false,
          message: "Post must have content or an image.",
        });
        return;
      }

      const post = await FeedService.createPost({ userId, content, imageUrl, visibility });

      res.status(201).json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  }
}
