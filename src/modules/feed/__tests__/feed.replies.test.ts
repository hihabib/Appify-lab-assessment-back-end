/**
 * Nested reply tests for POST /api/posts/:postId/comments (with parentId)
 * and GET /api/posts/comments/:commentId/replies.
 *
 * Mocks: DB, authenticate, upload, FeedService.
 */

jest.mock("../../../config/db", () => ({
  db: {},
  pool: { connect: jest.fn(), end: jest.fn() },
  connectDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../shared/middlewares/authenticate", () => ({
  authenticate: jest.fn(
    (req: { userId?: string }, _res: unknown, next: () => void) => {
      req.userId = "user-uuid-test";
      next();
    },
  ),
}));

jest.mock("../../../shared/middlewares/upload", () => ({
  upload: {
    single: jest.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  },
}));

jest.mock("../feed.service");

import request from "supertest";
import { FeedService } from "../feed.service";
import app from "../../../app";

const mockedAddComment = FeedService.addComment as jest.MockedFunction<
  typeof FeedService.addComment
>;
const mockedGetReplies = FeedService.getReplies as jest.MockedFunction<
  typeof FeedService.getReplies
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const POST_ID = "post-uuid-1";
const PARENT_COMMENT_ID = "comment-uuid-parent";
const REPLY_ID = "comment-uuid-reply";

const mockUser = {
  id: "user-uuid-test",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
};

const makeReply = (overrides: Partial<{
  id: string;
  content: string;
  parentId: string | null;
}> = {}) => ({
  id: REPLY_ID,
  postId: POST_ID,
  userId: "user-uuid-test",
  parentId: PARENT_COMMENT_ID,
  content: "I am a nested reply",
  createdAt: new Date("2025-07-01T13:00:00.000Z"),
  user: mockUser,
  likeCount: 0,
  isLikedByMe: false,
  myReactionType: null,
  ...overrides,
});

// ── POST with parentId (creates a reply) ─────────────────────────────────────

describe("POST /api/posts/:postId/comments (with parentId → reply)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 201 with parentId set when parentId is provided", async () => {
    mockedAddComment.mockResolvedValueOnce(makeReply());

    const res = await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .send({ content: "I am a nested reply", parentId: PARENT_COMMENT_ID });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.parentId).toBe(PARENT_COMMENT_ID);
    expect(res.body.data.content).toBe("I am a nested reply");
  });

  it("passes parentId to FeedService.addComment", async () => {
    mockedAddComment.mockResolvedValueOnce(makeReply());

    await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .send({ content: "Reply text", parentId: PARENT_COMMENT_ID });

    expect(mockedAddComment).toHaveBeenCalledWith(
      POST_ID,
      "user-uuid-test",
      "Reply text",
      PARENT_COMMENT_ID,
    );
  });

  it("passes undefined parentId when omitted (top-level comment)", async () => {
    mockedAddComment.mockResolvedValueOnce(
      makeReply({ parentId: null }),
    );

    await request(app)
      .post(`/api/posts/${POST_ID}/comments`)
      .send({ content: "Top-level comment" });

    expect(mockedAddComment).toHaveBeenCalledWith(
      POST_ID,
      "user-uuid-test",
      "Top-level comment",
      undefined,
    );
  });
});

// ── GET /api/posts/comments/:commentId/replies ────────────────────────────────

describe("GET /api/posts/comments/:commentId/replies", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with empty array when comment has no replies", async () => {
    mockedGetReplies.mockResolvedValueOnce([]);

    const res = await request(app)
      .get(`/api/posts/comments/${PARENT_COMMENT_ID}/replies`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it("returns 200 with replies that have parentId matching commentId", async () => {
    mockedGetReplies.mockResolvedValueOnce([makeReply()]);

    const res = await request(app)
      .get(`/api/posts/comments/${PARENT_COMMENT_ID}/replies`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].parentId).toBe(PARENT_COMMENT_ID);
    expect(res.body.data[0].user.firstName).toBe("Ada");
  });

  it("forwards page and limit to FeedService.getReplies", async () => {
    mockedGetReplies.mockResolvedValueOnce([]);

    await request(app)
      .get(`/api/posts/comments/${PARENT_COMMENT_ID}/replies?page=2&limit=5`);

    expect(mockedGetReplies).toHaveBeenCalledWith(PARENT_COMMENT_ID, 5, 5, "user-uuid-test");
  });

  it("returns 500 when FeedService throws", async () => {
    mockedGetReplies.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .get(`/api/posts/comments/${PARENT_COMMENT_ID}/replies`);

    expect(res.status).toBe(500);
  });
});
