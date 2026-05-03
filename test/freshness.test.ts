import { describe, it, expect } from "vitest";
import {
  resolveSLA,
  checkStaleness,
  describeSLAs,
} from "../src/freshness";

const registry = {
  "/api/premium/news/search": { maxAgeSeconds: 1800 },
  "/api/premium/providers": { maxAgeSeconds: 86400 },
  "/api/premium/history/pricing/series": null,
  "/api/premium/routing": null,
};

describe("resolveSLA", () => {
  it("matches exact path", () => {
    expect(resolveSLA(registry, "/api/premium/news/search")).toEqual({
      maxAgeSeconds: 1800,
    });
  });

  it("matches via path-prefix for templated paths", () => {
    expect(resolveSLA(registry, "/api/premium/providers/anthropic")).toEqual({
      maxAgeSeconds: 86400,
    });
  });

  it("returns null for unmatched paths", () => {
    expect(resolveSLA(registry, "/api/premium/unknown")).toBeNull();
  });

  it("returns null for endpoints registered as null (compute-only)", () => {
    expect(resolveSLA(registry, "/api/premium/routing")).toBeNull();
  });
});

describe("checkStaleness", () => {
  const now = new Date("2026-05-03T12:00:00Z");

  it("flags stale when age exceeds SLA", () => {
    const result = checkStaleness(
      registry,
      "/api/premium/news/search",
      "2026-05-03T11:00:00Z", // 1 hour old, SLA 30 min
      now,
    );
    expect(result.applies).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.ageSeconds).toBe(3600);
    expect(result.slaSeconds).toBe(1800);
  });

  it("does not flag stale when fresh", () => {
    const result = checkStaleness(
      registry,
      "/api/premium/news/search",
      "2026-05-03T11:50:00Z", // 10 min old
      now,
    );
    expect(result.applies).toBe(true);
    expect(result.stale).toBe(false);
  });

  it("returns applies:false for compute-only endpoints", () => {
    const result = checkStaleness(
      registry,
      "/api/premium/routing",
      "2026-05-03T11:00:00Z",
      now,
    );
    expect(result.applies).toBe(false);
    expect(result.stale).toBe(false);
  });

  it("treats null capturedAt as fresh (lenient)", () => {
    const result = checkStaleness(
      registry,
      "/api/premium/news/search",
      null,
      now,
    );
    expect(result.applies).toBe(true);
    expect(result.stale).toBe(false);
  });

  it("treats unparseable capturedAt as fresh (lenient)", () => {
    const result = checkStaleness(
      registry,
      "/api/premium/news/search",
      "not-a-date",
      now,
    );
    expect(result.applies).toBe(true);
    expect(result.stale).toBe(false);
  });
});

describe("describeSLAs", () => {
  it("flattens registry into the public-facing array shape", () => {
    const out = describeSLAs(registry, {
      "/api/premium/news/search": "news refreshes every 10 min",
    });
    expect(out).toContainEqual({
      endpoint: "/api/premium/news/search",
      max_age_seconds: 1800,
      reason: "news refreshes every 10 min",
    });
    expect(out).toContainEqual({
      endpoint: "/api/premium/routing",
      max_age_seconds: null,
      reason: "",
    });
  });
});
