/**
 * Tests for GET /api/likes/:entityType/:entityId/users
 *
 * Mocks: DB, authenticate (injects userId), LikesService.
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

jest.mock("../likes.service");

import request from "supertest";
import { LikesService } from "../likes.service";
import app from "../../../app";

const mockedGetLikers = LikesService.getLikers as jest.MockedFunction<
  typeof LikesService.getLikers
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const POST_ID = "post-uuid-1";
const COMMENT_ID = "comment-uuid-1";

const makeLikerRow = (overrides: Partial<{ likeId: string; firstName: string }> = {}) => ({
  likeId: "like-uuid-1",
  reactionType: "like",
  createdAt: new Date("2025-07-01T12:00:00.000Z"),
  user: {
    id: "user-uuid-a",
    firstName: overrides.firstName ?? "Ada",
    lastName: "Lovelace",
  },
  ...overrides,
});

// ── GET /api/likes/:entityType/:entityId/users ─────────────────────────────

describe("GET /api/likes/:entityType/:entityId/users", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with empty array when entity has no likes", async () => {
    mockedGetLikers.mockResolvedValueOnce([]);

    const res = await request(app).get(`/api/likes/post/${POST_ID}/users`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
  });

  it("returns 200 with liker rows containing user profile fields", async () => {
    mockedGetLikers.mockResolvedValueOnce([makeLikerRow()]);

    const res = await request(app).get(`/api/likes/post/${POST_ID}/users`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty("likeId", "like-uuid-1");
    expect(res.body.data[0].user).toHaveProperty("firstName", "Ada");
    expect(res.body.data[0].user).toHaveProperty("lastName", "Lovelace");
    expect(res.body.data[0].user).toHaveProperty("id");
  });

  it("does not expose passwordHash in the response", async () => {
    mockedGetLikers.mockResolvedValueOnce([makeLikerRow()]);

    const res = await request(app).get(`/api/likes/post/${POST_ID}/users`);

    expect(res.body.data[0].user).not.toHaveProperty("passwordHash");
    expect(res.body.data[0].user).not.toHaveProperty("password");
  });

  it("works for entityType=comment", async () => {
    mockedGetLikers.mockResolvedValueOnce([makeLikerRow()]);

    const res = await request(app).get(`/api/likes/comment/${COMMENT_ID}/users`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("forwards entityType, entityId, page and limit to LikesService.getLikers", async () => {
    mockedGetLikers.mockResolvedValueOnce([]);

    await request(app).get(`/api/likes/post/${POST_ID}/users?page=2&limit=5`);

    expect(mockedGetLikers).toHaveBeenCalledWith("post", POST_ID, 2, 5);
  });

  it("returns 400 for an invalid entityType", async () => {
    const res = await request(app).get(`/api/likes/reaction/${POST_ID}/users`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockedGetLikers).not.toHaveBeenCalled();
  });

  it("returns 500 when LikesService.getLikers throws", async () => {
    mockedGetLikers.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app).get(`/api/likes/post/${POST_ID}/users`);

    expect(res.status).toBe(500);
  });
});
