import type { Request, Response, NextFunction } from "express";

/**
 * Shape of a structured API error.
 * Throw or pass this to next() anywhere in the app.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

/**
 * Centralised Express error-handling middleware.
 * Must be registered AFTER all routes in app.ts.
 *
 * Converts any thrown/passed error into a consistent JSON response:
 * { success: false, statusCode: number, message: string, stack?: string }
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isDev = process.env.NODE_ENV === "development";

  const statusCode = (err as AppError).statusCode ?? 500;
  const message =
    (err as AppError).isOperational || isDev
      ? err.message
      : "An unexpected error occurred. Please try again later.";

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    ...(isDev && { stack: err.stack }),
  });
};
