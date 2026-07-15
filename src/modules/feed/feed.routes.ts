import { Router, type IRouter } from "express";
import { FeedController } from "./feed.controller";
import { authenticate } from "../../shared/middlewares/authenticate";
import { upload } from "../../shared/middlewares/upload";
import { strictLimiter } from "../../shared/middlewares/rateLimiter";

const router: IRouter = Router();

// GET /api/posts — paginated public feed, requires JWT
router.get("/", authenticate, FeedController.getPosts);

// POST /api/posts — create a post (text + optional image upload), requires JWT
// strictLimiter prevents spam posting (20 posts / hour per IP)
router.post(
  "/",
  strictLimiter,
  authenticate,
  upload.single("image"),
  FeedController.createPost,
);

// GET  /api/posts/comments/:commentId/replies — direct replies to a comment, requires JWT
// (must be declared before /:postId/* routes to avoid param shadowing)
router.get(
  "/comments/:commentId/replies",
  authenticate,
  FeedController.getReplies,
);

// GET  /api/posts/:postId/comments — top-level comments for a post, requires JWT
router.get("/:postId/comments", authenticate, FeedController.getComments);

// POST /api/posts/:postId/comments — add a top-level comment, requires JWT
router.post("/:postId/comments", authenticate, FeedController.addComment);

export default router;
