import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../../config/db";
import { users } from "./auth.schema";
import { AppError } from "../../shared/middlewares/errorHandler";

const SALT_ROUNDS = 10;

/** Throws if JWT_SECRET is not configured — catches misconfigured environments at call time. */
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set.");
  return secret;
};

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class AuthService {
  /**
   * Registers a new user.
   * Throws 409 if email is already taken.
   * Returns the public user object (no passwordHash) + signed JWT.
   */
  static async register(data: RegisterDto) {
    // 1. Uniqueness check (also enforced at DB level — this gives a cleaner 409)
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()));

    if (existing.length > 0) {
      throw new AppError("Email is already in use.", 409);
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // 3. Insert user — return only public columns
    const [newUser] = await db
      .insert(users)
      .values({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.toLowerCase().trim(),
        passwordHash,
      })
      .returning({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    // 4. Issue JWT
    const token = jwt.sign({ userId: newUser.id }, getJwtSecret(), {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as jwt.SignOptions["expiresIn"],
    });

    return { user: newUser, token };
  }

  /**
   * Returns the public profile for the authenticated user.
   * Used by GET /api/auth/me to rehydrate user state after page refresh.
   */
  static async getMe(userId: string) {
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

    if (!user) throw new AppError("User not found.", 404);
    return { user };
  }

  /**
   * Authenticates an existing user.
   * Always throws a generic 401 on any credential mismatch (avoids email enumeration).
   * Returns the public user object + signed JWT.
   */
  static async login(data: LoginDto) {
    // 1. Fetch user (deliberately vague error if not found)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase().trim()));

    if (!user) {
      throw new AppError("Invalid email or password.", 401);
    }

    // 2. Verify password
    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new AppError("Invalid email or password.", 401);
    }

    // 3. Issue JWT
    const token = jwt.sign({ userId: user.id }, getJwtSecret(), {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as jwt.SignOptions["expiresIn"],
    });

    // 4. Strip sensitive field before returning
    const { passwordHash: _omit, ...publicUser } = user;
    return { user: publicUser, token };
  }
}
