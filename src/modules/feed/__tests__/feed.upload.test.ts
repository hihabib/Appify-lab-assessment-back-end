/**
 * POST /api/posts upload tests.
 *
 * Mocks:
 *  - DB config        → no real Postgres needed
 *  - authenticate     → bypassed; userId injected via middleware mock
 *  - upload middleware → bypassed so we don't touch the filesystem
 *  - FeedService      → controlled return values
 */

// Must be hoisted before any transitive DB import
jest.mock("../../../config/db", () => ({
  db: {},
  pool: { connect: jest.fn(), end: jest.fn() },
  connectDatabase: jest.fn().mockResolvedValue(undefined),
}));

// Inject a fixed userId so controller can read (req as AuthenticatedRequest).userId
jest.mock("../../../shared/middlewares/authenticate", () => ({
  authenticate: jest.fn(
    (req: { userId?: string }, _res: unknown, next: () => void) => {
      req.userId = "user-uuid-test";
      next();
    },
  ),
}));

// Skip real disk storage — simulate req.file being set
jest.mock("../../../shared/middlewares/upload", () => ({
  upload: {
    single: jest.fn(
      () =>
        (
          req: { file?: object },
          _res: unknown,
          next: () => void,
        ) => {
          // Default: no file attached. Individual tests override via mock impl.
          next();
        },
    ),
  },
}));

// Mock the service so we control responses
jest.mock("../feed.service");

import request from "supertest";
import { FeedService } from "../feed.service";
import app from "../../../app";

const mockedCreatePost = FeedService.createPost as jest.MockedFunction<
  typeof FeedService.createPost
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockUser = {
  id: "user-uuid-test",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

const makeCreatedPost = (overrides: Partial<{
  content: string | null;
  imageUrl: string | null;
}> = {}) => ({
  id: "post-uuid-new",
  userId: "user-uuid-test",
  content: "Hello from test",
  imageUrl: null,
  visibility: "public" as const,
  createdAt: new Date("2025-07-01T10:00:00.000Z"),
  user: mockUser,
  likeCount: 0,
  commentCount: 0,
  isLikedByMe: false,
  myReactionType: null,
  topReactors: null,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/posts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 201 with created post when content is provided", async () => {
    mockedCreatePost.mockResolvedValueOnce(makeCreatedPost());

    const res = await request(app)
      .post("/api/posts")
      .field("content", "Hello from test");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe("post-uuid-new");
    expect(res.body.data.content).toBe("Hello from test");
    expect(res.body.data.likeCount).toBe(0);
    expect(res.body.data.commentCount).toBe(0);
    expect(res.body.data.user.firstName).toBe("Ada");
  });

  it("calls FeedService.createPost with userId, content, and null imageUrl", async () => {
    mockedCreatePost.mockResolvedValueOnce(makeCreatedPost());

    await request(app)
      .post("/api/posts")
      .field("content", "Test content");

    expect(mockedCreatePost).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-uuid-test",
        content: "Test content",
        imageUrl: null,
      }),
    );
  });

  it("returns 400 when neither content nor image is provided", async () => {
    const res = await request(app)
      .post("/api/posts")
      .field("content", "");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/content or an image/i);
    expect(mockedCreatePost).not.toHaveBeenCalled();
  });

  it("returns 201 with imageUrl when post has an image", async () => {
    mockedCreatePost.mockResolvedValueOnce(
      makeCreatedPost({ content: null, imageUrl: "/uploads/abc-uuid.jpg" }),
    );

    const res = await request(app)
      .post("/api/posts")
      .field("content", "Image post");

    expect(res.status).toBe(201);
    expect(res.body.data.imageUrl).toBe("/uploads/abc-uuid.jpg");
  });

  it("returns 500 when FeedService.createPost throws", async () => {
    mockedCreatePost.mockRejectedValueOnce(new Error("DB write failed"));

    const res = await request(app)
      .post("/api/posts")
      .field("content", "This will fail");

    expect(res.status).toBe(500);
  });
});
