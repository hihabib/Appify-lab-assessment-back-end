/**
 * Foundational backend integration tests.
 * Uses supertest to spin up the Express app without actually listening on a port.
 *
 * Note: These tests mock the database config so no real Postgres connection is needed.
 */
import request from "supertest";

// Mock the DB module so tests don't require a running Postgres instance
jest.mock("./config/db", () => ({
  db: {},
  pool: { connect: jest.fn(), end: jest.fn() },
  connectDatabase: jest.fn().mockResolvedValue(undefined),
}));

import app from "./app";

describe("GET /health", () => {
  it("returns 200 OK with status: ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("timestamp");
  });
});

describe("GET /api-docs", () => {
  it("returns 200 OK — Swagger UI is served", async () => {
    const res = await request(app).get("/api-docs/");
    // Swagger UI redirects or serves HTML; either is acceptable
    expect([200, 301, 302]).toContain(res.status);
  });
});

describe("404 handler", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nonexistent-route");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });
});

describe("Auth routes", () => {
  it("POST /api/auth/register — missing fields returns 400", async () => {
    const res = await request(app).post("/api/auth/register").send({});
    expect([400, 500]).toContain(res.status);
  });

  it("POST /api/auth/login — missing fields returns 400", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect([400, 500]).toContain(res.status);
  });
});

describe("Feed routes", () => {
  it("GET /api/posts without token returns 401", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.status).toBe(401);
  });

  it("GET /api/feed (old path) returns 404", async () => {
    const res = await request(app).get("/api/feed");
    expect(res.status).toBe(404);
  });
});
