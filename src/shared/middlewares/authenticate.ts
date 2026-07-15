import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "./errorHandler";

/**
 * Extends Express Request to carry the authenticated userId.
 * Import this type in protected controllers instead of the base Request.
 */
export interface AuthenticatedRequest extends Request {
  userId: string;
}

interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set.");
  return secret;
};

/**
 * JWT authentication middleware.
 *
 * Expects:  Authorization: Bearer <token>
 * On success: attaches req.userId and calls next()
 * On failure: forwards an AppError(401) to the global error handler
 *
 * Usage in routes:
 *   router.get("/protected", authenticate, controller.method);
 */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authentication required. No token provided.", 401);
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new AppError("Authentication required. Malformed token.", 401);
    }

    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    (req as AuthenticatedRequest).userId = payload.userId;

    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
    } else if (err instanceof jwt.TokenExpiredError) {
      next(new AppError("Token has expired. Please log in again.", 401));
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(new AppError("Invalid token.", 401));
    } else {
      next(new AppError("Authentication failed.", 401));
    }
  }
};
