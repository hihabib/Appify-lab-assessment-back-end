import { Router, type IRouter } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "../../shared/middlewares/authenticate";

const router: IRouter = Router();

/**
 * POST /api/auth/register
 * Body: { firstName, lastName, email, password }
 * Returns: { success, user, token }
 */
router.post("/register", AuthController.register);

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { success, user, token }
 */
router.post("/login", AuthController.login);

/**
 * GET /api/auth/me
 * Returns the authenticated user's public profile.
 * Used by the frontend to rehydrate user state after page refresh.
 */
router.get("/me", authenticate, AuthController.me);

export default router;
