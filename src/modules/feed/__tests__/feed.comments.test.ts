/**
 * GET/POST /api/posts/:postId/comments tests.
 *
 * Mocks:
 *  - DB config        → no real Postgres needed
 *  - authenticate     → bypassed; injects fixed userId
 *  - FeedService      → controlled return values
 */

// Must be hoisted before any transitive DB import
jest.mock("../../../config/db", () => ({
  db: {},
  pool: { connect: jest.fn(), end: jest.fn() },
  connectDatabase: jest.fn().mockResolvedValue(undefined),
}));

// Inject a fixed userId for authenticated routes
jest.mock("../../../shared/middlewares/authenticate", () => ({
  authenticate: jest.fn(
    (req: { userId?: string }, _res: unknown, next: () => void) => {
      req.userId = "user-uuid-test";
      next();
    },
  ),
}));

// Bypass Multer so POST /api/posts doesn't error about missing upload dir
jest.mock("../../../shared/middlewares/upload", () => ({
  upload: {
    single: jest.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  },
}));

jest.mock("../feed.service");

import request from "supertest";
import { FeedService } from "../feed.service";
import app from "../../../app";

const mockedGetTopLevelComments = FeedService.getTopLevelComments as jest.MockedFunction<
  typeof FeedService.getTopLevelComments
>;
const mockedAddComment = FeedService.addComment as jest.MockedFunction<
  typeof FeedService.addComment
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const POST_ID = "post-uuid-1";

const mockUser = {
  id: "user-uuid-test",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

const makeComment = (overrides: Partial<{
  id: string;
  content: string;
}> = {}) => ({
  id: "comment-uuid-1",
  postId: POST_ID,
  userId: "user-uuid-test",
  parentId: null,
  content: "Great post!",
  createdAt: new Date("2025-07-01T12:00:00.000Z"),
  user: mockUser,
  likeCount: 0,
  isLikedByMe: false,
  myReactionType: null,
  ...overrides,
});

// ── GET /api/posts/:postId/comments ──────────────────────────────────────────

describe("GET /api/posts/:postId/comments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with empty array when post has no comments", async () => {
    mockedGetTopLevelComments.mockResolvedValueOnce([]);

    const res = await request(app).get(`/api/posts/${POST_ID}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.page).toBe(1);
  });

  it("returns 200 with comments and joined user info", async () => {
    mockedGetTopLevelComments.mockResolvedValueOnce([makeComment()]);

    const res = await request(app).get(`/api/posts/${POST_ID}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const comment = res.body.data[0];
    expect(comment.id).toBe("comment-uuid-1");
    expect(comment.content).toBe("Great post!");
    expect(comment.parentId).toBeNull();
    expect(comment.user.firstName).toBe("Ada");
  });

  it("forwards page and limit to FeedService", async () => {
    mockedGetTopLevelComments.mockResolvedValueOnce([]);

    await request(app).get(`/api/posts/${POST_ID}/comments?page=2&limit=5`);

    expect(mockedGetTopLevelComments).toHaveBeenCalledWith(POST_ID, 5, 5, "user-uuid-test");
  });

  it("only returns top-level comments (parentId is null)", async () => {
    mockedGetTopLevelComments.mockResolvedValueOnce([
      makeComment({ id: "c1" }),
      makeComment({ id: "c2" }),
    ]);

    const res = await request(app).get(`/api/posts/${POST_ID}/comments`);

    res.body.data.forEach((c: { parentId: unknown }) => {
      expect(c.parentId).toBeNull();
    });
  });

  it("returns 500 when FeedService throws", async () => {
    mockedGetTopLevelComments.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).get(`/api/posts/${POST_ID}/comments`);

    expect(res.status).toBe(500);
  });
});

// ── POST /api/posts/:postId/comments ─────────────────────────────────────────

describe("POST /api/posts/:postId/comments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 201 with created comment", async () => {
    mockedAddComment.mockResolvedValueOnce(makeComment({ content: "Great post!" }));

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .send({ content: "Great post!" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe("Great post!");
    expect(res.body.data.parentId).toBeNull();
    expect(res.body.data.user.firstName).toBe("Ada");
  });

  it("calls FeedService.addComment with correct userId and postId", async () => {
    mockedAddComment.mockResolvedValueOnce(makeComment());

    await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .send({ content: "Test comment" });

    expect(mockedAddComment).toHaveBeenCalledWith(
      POST_ID,
      "user-uuid-test",
      "Test comment",
    );
  });

  it("returns 400 when content is missing", async () => {
    const res = await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockedAddComment).not.toHaveBeenCalled();
  });

  it("returns 400 when content is empty string", async () => {
    const res = await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .send({ content: "   " });

    expect(res.status).toBe(400);
    expect(mockedAddComment).not.toHaveBeenCalled();
  });

  it("returns 500 when FeedService throws", async () => {
    mockedAddComment.mockRejectedValueOnce(new Error("DB write failed"));

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .send({ content: "This will fail" });

    expect(res.status).toBe(500);
  });
});
