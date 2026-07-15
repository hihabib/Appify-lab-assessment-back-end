/**
 * Tests for POST /api/likes/toggle
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

const mockedToggleLike = LikesService.toggleLike as jest.MockedFunction<
  typeof LikesService.toggleLike
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const POST_ENTITY_ID = "post-uuid-1";
const COMMENT_ENTITY_ID = "comment-uuid-1";

// ── POST /api/likes/toggle ────────────────────────────────────────────────────

describe("POST /api/likes/toggle", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 200 with action=liked when a new like is created", async () => {
    mockedToggleLike.mockResolvedValueOnce({
      action: "liked",
      entityType: "post",
      entityId: POST_ENTITY_ID,
      reactionType: "like",
    });

    const res = await request(app)
      .post("/api/likes/toggle")
      .send({ entityType: "post", entityId: POST_ENTITY_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe("liked");
    expect(res.body.data.entityType).toBe("post");
    expect(res.body.data.entityId).toBe(POST_ENTITY_ID);
  });

  it("returns 200 with action=unliked when the existing like is removed", async () => {
    mockedToggleLike.mockResolvedValueOnce({
      action: "unliked",
      entityType: "post",
      entityId: POST_ENTITY_ID,
      reactionType: "like",
    });

    const res = await request(app)
      .post("/api/likes/toggle")
      .send({ entityType: "post", entityId: POST_ENTITY_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe("unliked");
  });

  it("forwards userId, entityType, and entityId to LikesService.toggleLike", async () => {
    mockedToggleLike.mockResolvedValueOnce({
      action: "liked",
      entityType: "comment",
      entityId: COMMENT_ENTITY_ID,
      reactionType: "like",
    });

    await request(app)
      .post("/api/likes/toggle")
      .send({ entityType: "comment", entityId: COMMENT_ENTITY_ID });

    expect(mockedToggleLike).toHaveBeenCalledWith(
      "user-uuid-test",
      "comment",
      COMMENT_ENTITY_ID,
      "like",
    );
  });

  it("returns 400 when entityType is an invalid value", async () => {
    const res = await request(app)
      .post("/api/likes/toggle")
      .send({ entityType: "reaction", entityId: POST_ENTITY_ID });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockedToggleLike).not.toHaveBeenCalled();
  });

  it("returns 400 when entityType is missing", async () => {
    const res = await request(app)
      .post("/api/likes/toggle")
      .send({ entityId: POST_ENTITY_ID });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 when entityId is missing", async () => {
    const res = await request(app)
      .post("/api/likes/toggle")
      .send({ entityType: "post" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockedToggleLike).not.toHaveBeenCalled();
  });

  it("returns 500 when LikesService.toggleLike throws", async () => {
    mockedToggleLike.mockRejectedValueOnce(new Error("DB error"));

    const res = await request(app)
      .post("/api/likes/toggle")
      .send({ entityType: "post", entityId: POST_ENTITY_ID });

    expect(res.status).toBe(500);
  });
});
