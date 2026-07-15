import type { Request, Response, NextFunction } from "express";
import { AuthService, type RegisterDto, type LoginDto } from "./auth.service";
import { AppError } from "../../shared/middlewares/errorHandler";
import type { AuthenticatedRequest } from "../../shared/middlewares/authenticate";

// ─── Inline validation helpers ────────────────────────────────────────────────

const validateRegisterBody = (body: Partial<RegisterDto>): RegisterDto => {
  const { firstName, lastName, email, password } = body;
  if (!firstName?.trim()) throw new AppError("firstName is required.", 400);
  if (!lastName?.trim()) throw new AppError("lastName is required.", 400);
  if (!email?.trim()) throw new AppError("email is required.", 400);
  if (!password) throw new AppError("password is required.", 400);
  if (password.length < 8)
    throw new AppError("password must be at least 8 characters.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AppError("email is not valid.", 400);
  return { firstName, lastName, email, password };
};

const validateLoginBody = (body: Partial<LoginDto>): LoginDto => {
  const { email, password } = body;
  if (!email?.trim()) throw new AppError("email is required.", 400);
  if (!password) throw new AppError("password is required.", 400);
  return { email, password };
};

// ─── Controller ───────────────────────────────────────────────────────────────

export class AuthController {
  static async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const dto = validateRegisterBody(req.body as Partial<RegisterDto>);
      const result = await AuthService.register(dto);
      res.status(201).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async me(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await AuthService.getMe((req as AuthenticatedRequest).userId);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  static async login(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const dto = validateLoginBody(req.body as Partial<LoginDto>);
      const result = await AuthService.login(dto);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}
