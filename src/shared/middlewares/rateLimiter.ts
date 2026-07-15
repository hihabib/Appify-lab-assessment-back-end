import { rateLimit } from "express-rate-limit";

/**
 * Global API rate limiter — applied to all /api/* routes.
 *
 * Allows up to 100 requests per IP per 15-minute window.
 * Returns RFC-compliant `RateLimit-*` headers (draft-6).
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100,               // max requests per window per IP
  standardHeaders: true,    // Return `RateLimit-*` headers
  legacyHeaders: false,     // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
});

/**
 * Strict limiter — applied to sensitive mutation endpoints:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   POST /api/posts  (post creation)
 *
 * Allows up to 20 requests per IP per hour to defend against
 * credential brute-force and spam posting.
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many sensitive requests, please try again later.",
  },
});
