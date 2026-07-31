import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRequestIP, getRequestHeader } = vi.hoisted(() => ({
  getRequestIP: vi.fn<() => string | undefined>(() => "203.0.113.7"),
  getRequestHeader: vi.fn<(name: string) => string | undefined>(() => undefined),
}));

vi.mock("@tanstack/react-start/server", () => ({ getRequestIP, getRequestHeader }));

import { checkRateLimit, enforceRateLimit, rateLimitResponse } from "../rate-limit.server";

let seq = 0;
function route() {
  seq += 1;
  return `test:route-${seq}`;
}

beforeEach(() => {
  getRequestIP.mockReturnValue("203.0.113.7");
  getRequestHeader.mockReturnValue(undefined);
});

describe("checkRateLimit", () => {
  it("libera dentro do limite e bloqueia ao excedê-lo", () => {
    const opts = { route: route(), max: 3, windowMs: 60_000 };
    expect(checkRateLimit(opts)).toMatchObject({ ok: true, remaining: 2 });
    expect(checkRateLimit(opts)).toMatchObject({ ok: true, remaining: 1 });
    expect(checkRateLimit(opts)).toMatchObject({ ok: true, remaining: 0 });
    const blocked = checkRateLimit(opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isola os contadores por IP", () => {
    const opts = { route: route(), max: 1, windowMs: 60_000 };
    expect(checkRateLimit(opts).ok).toBe(true);
    getRequestIP.mockReturnValue("198.51.100.2");
    expect(checkRateLimit(opts).ok).toBe(true);
    expect(checkRateLimit(opts).ok).toBe(false);
  });

  it("isola os contadores por rota", () => {
    const a = { route: route(), max: 1, windowMs: 60_000 };
    const b = { route: route(), max: 1, windowMs: 60_000 };
    expect(checkRateLimit(a).ok).toBe(true);
    expect(checkRateLimit(b).ok).toBe(true);
    expect(checkRateLimit(a).ok).toBe(false);
  });

  it("libera novamente após a janela expirar", () => {
    const now = vi.spyOn(Date, "now");
    const opts = { route: route(), max: 1, windowMs: 1_000 };
    now.mockReturnValue(1_000_000);
    expect(checkRateLimit(opts).ok).toBe(true);
    expect(checkRateLimit(opts).ok).toBe(false);
    now.mockReturnValue(1_002_000);
    expect(checkRateLimit(opts).ok).toBe(true);
    now.mockRestore();
  });

  it("usa headers de proxy quando o IP direto não está disponível", () => {
    getRequestIP.mockReturnValue(undefined);
    getRequestHeader.mockImplementation((name) =>
      name === "x-forwarded-for" ? "192.0.2.9, 10.0.0.1" : undefined,
    );
    expect(checkRateLimit({ route: route(), max: 5 }).ip).toBe("192.0.2.9");
  });

  it("cai para 'unknown' sem IP identificável", () => {
    getRequestIP.mockReturnValue(undefined);
    expect(checkRateLimit({ route: route(), max: 5 }).ip).toBe("unknown");
  });
});

describe("rateLimitResponse / enforceRateLimit", () => {
  it("responde 429 com Retry-After", async () => {
    const opts = { route: route(), max: 1, windowMs: 60_000 };
    expect(enforceRateLimit(opts)).toBeNull();
    const res = enforceRateLimit(opts, { "access-control-allow-origin": "*" });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toBeTruthy();
    expect(res!.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res!.headers.get("access-control-allow-origin")).toBe("*");
    await expect(res!.json()).resolves.toMatchObject({ error: "rate_limited" });
  });

  it("não vaza o IP no corpo da resposta", async () => {
    const opts = { route: route(), max: 1, windowMs: 60_000 };
    const result = { ok: false, remaining: 0, retryAfterSec: 30, ip: "203.0.113.7" } as const;
    const body = await rateLimitResponse(result, opts).text();
    expect(body).not.toContain("203.0.113.7");
  });
});
