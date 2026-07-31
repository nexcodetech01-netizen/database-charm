import { describe, expect, it } from "vitest";
import { computeBackoffDelay, parseRetryAfter, shouldRetryStatus } from "../http-client.server";

describe("http-client.server", () => {
  it("faz retry apenas em status transitórios", () => {
    expect(shouldRetryStatus(429)).toBe(true);
    expect(shouldRetryStatus(500)).toBe(true);
    expect(shouldRetryStatus(503)).toBe(true);
    expect(shouldRetryStatus(408)).toBe(true);
    expect(shouldRetryStatus(400)).toBe(false);
    expect(shouldRetryStatus(401)).toBe(false);
    expect(shouldRetryStatus(404)).toBe(false);
  });

  it("interpreta Retry-After em segundos", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("not-a-date")).toBeNull();
  });

  it("cresce exponencialmente e respeita o teto", () => {
    const first = computeBackoffDelay(1, 400, 8000);
    const third = computeBackoffDelay(3, 400, 8000);
    expect(first).toBeGreaterThanOrEqual(200);
    expect(first).toBeLessThanOrEqual(400);
    expect(third).toBeGreaterThanOrEqual(800);
    expect(computeBackoffDelay(20, 400, 8000)).toBeLessThanOrEqual(8000);
  });
});
