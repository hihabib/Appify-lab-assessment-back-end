import { Router, type IRouter } from "express";
import { authenticate } from "../../shared/middlewares/authenticate";
import { strictLimiter } from "../../shared/middlewares/rateLimiter";
import { LikesController } from "./likes.controller";

const router: IRouter = Router();

/**
 * POST /api/likes/toggle
 * Toggle like/unlike on any entity (post or comment).
 * strictLimiter prevents like-spam (20 req / hour per IP).
 * Requires a valid JWT.
 */
router.post("/toggle", strictLimiter, authenticate, LikesController.toggleLike);

/**
 * GET /api/likes/:entityType/:entityId/users
 * Retrieve paginated list of users who liked a post or comment.
 * Requires a valid JWT.
 */
router.get("/:entityType/:entityId/users", authenticate, LikesController.getLikers);

export default router;
