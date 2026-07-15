import type { Request, Response, NextFunction } from "express";
import { LikesService, type EntityType } from "./likes.service";
import type { AuthenticatedRequest } from "../../shared/middlewares/authenticate";
import { REACTION_TYPES, type ReactionType } from "../feed/feed.schema";

const VALID_ENTITY_TYPES: EntityType[] = ["post", "comment"];

/** RFC 4122 UUID v4 pattern */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUUID = (value: string): boolean => UUID_REGEX.test(value);

export class LikesController {
  /**
   * POST /api/likes/toggle
   *
   * Body (JSON):
   *   entityType — "post" | "comment"
   *   entityId   — UUID of the target entity
   *
   * Response:
   *   200  { success: true, data: { action: "liked"|"unliked", entityType, entityId } }
   */
  static async toggleLike(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).userId;
      const { entityType, entityId, reactionType } = req.body as {
        entityType?: string;
        entityId?: string;
        reactionType?: string;
      };

      if (!entityType || !VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
        res.status(400).json({
          success: false,
          message: "entityType must be 'post' or 'comment'.",
        });
        return;
      }

      if (!entityId?.trim()) {
        res.status(400).json({
          success: false,
          message: "entityId is required.",
        });
        return;
      }

      if (!isValidUUID(entityId.trim())) {
        res.status(400).json({
          success: false,
          message: "entityId must be a valid UUID.",
        });
        return;
      }

      const resolvedReaction: ReactionType =
        reactionType && REACTION_TYPES.includes(reactionType as ReactionType)
          ? (reactionType as ReactionType)
          : "like";

      const result = await LikesService.toggleLike(
        userId,
        entityType as EntityType,
        entityId.trim(),
        resolvedReaction,
      );

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/likes/:entityType/:entityId/users
   *
   * Path params:
   *   entityType — "post" | "comment"
   *   entityId   — UUID of the target entity
   *
   * Query params:
   *   page  — 1-based page number (default 1)
   *   limit — results per page (default 20)
   *
   * Response:
   *   200  { success: true, data: Liker[], meta: { page, limit } }
   */
  static async getLikers(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Express 5: route params are typed as string | string[] — cast explicitly
      const entityType = req.params.entityType as string;
      const entityId = req.params.entityId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      if (!VALID_ENTITY_TYPES.includes(entityType as EntityType)) {
        res.status(400).json({
          success: false,
          message: "entityType must be 'post' or 'comment'.",
        });
        return;
      }

      if (!isValidUUID(entityId)) {
        res.status(400).json({
          success: false,
          message: "entityId must be a valid UUID.",
        });
        return;
      }

      const data = await LikesService.getLikers(
        entityType as EntityType,
        entityId,
        page,
        limit,
      );

      res.status(200).json({ success: true, data, meta: { page, limit } });
    } catch (err) {
      next(err);
    }
  }
}
