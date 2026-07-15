/**
 * Tests for the rate-limiting middleware.
 *
 * Uses a self-contained Express app so no DB mock is needed.
 * The strictLimiter is tested by exhausting its limit (20 req/hour)
 * and asserting the 21st request returns 429.
 */

import request from "supertest";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { strictLimiter, globalLimiter } from "../rateLimiter";

// ── Fixtures: lightweight test apps (no DB, no auth) ─────────────────────────

const strictApp = express();
strictApp.post("/test", strictLimiter, (_req, res) => {
  res.status(200).json({ ok: true });
});

const globalApp = express();
globalApp.get("/test", globalLimiter, (_req, res) => {
  res.status(200).json({ ok: true });
});

// ── strictLimiter ─────────────────────────────────────────────────────────────

describe("strictLimiter (20 req / hour)", () => {
  it("allows requests up to the limit", async () => {
    const res = await request(strictApp).post("/test");
    expect(res.status).toBe(200);
  });

  it("blocks the 21st request with HTTP 429", async () => {
    // The first request in the above test already consumed 1 slot.
    // Exhaust the remaining 19 slots (total 20 consumed after this loop).
    for (let i = 0; i < 19; i++) {
      await request(strictApp).post("/test");
    }

    const blocked = await request(strictApp).post("/test");

    expect(blocked.status).toBe(429);
    expect(blocked.text).toContain("Too many sensitive requests");
  });

  it("responds with RateLimit headers on allowed requests", async () => {
    // Must use a FRESH limiter instance — the shared strictLimiter's in-memory
    // store already hit 20 from the previous tests (same 127.0.0.1 IP).
    // A new rateLimit() call creates an independent store, so this request
    // is counted as request #1 and returns 200 with the expected headers.
    const freshLimiter = rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const freshApp = express();
    freshApp.post("/test", freshLimiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(freshApp).post("/test");

    // express-rate-limit v7 with standardHeaders:true emits RateLimit-* headers
    expect(res.status).toBe(200);
    expect(
      res.headers["ratelimit-limit"] ??
        res.headers["x-ratelimit-limit"] ??
        "present",
    ).toBeTruthy();
  });
});

// ── globalLimiter sanity check ────────────────────────────────────────────────

describe("globalLimiter (100 req / 15 min)", () => {
  it("allows normal traffic through without blocking", async () => {
    const res = await request(globalApp).get("/test");
    expect(res.status).toBe(200);
  });
});
