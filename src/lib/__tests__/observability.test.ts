import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createLogger,
  readOrCreateCorrelationId,
  CORRELATION_HEADER_NAME,
} from "../observability";

describe("observability", () => {
  const logs: string[] = [];
  let spyLog: ReturnType<typeof vi.spyOn>;
  let spyErr: ReturnType<typeof vi.spyOn>;
  let spyWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs.length = 0;
    spyLog = vi.spyOn(console, "log").mockImplementation((s) => logs.push(String(s)));
    spyErr = vi.spyOn(console, "error").mockImplementation((s) => logs.push(String(s)));
    spyWarn = vi.spyOn(console, "warn").mockImplementation((s) => logs.push(String(s)));
  });
  afterEach(() => {
    spyLog.mockRestore();
    spyErr.mockRestore();
    spyWarn.mockRestore();
  });

  it("emite JSON linha-a-linha com metadados", () => {
    const log = createLogger({ module: "pricing", correlationId: "cid-1", companyId: "co-1" });
    log.info("resolve.start", { productId: "p1" });
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.level).toBe("info");
    expect(parsed.module).toBe("pricing");
    expect(parsed.correlationId).toBe("cid-1");
    expect(parsed.companyId).toBe("co-1");
    expect(parsed.event).toBe("resolve.start");
    expect(parsed.ctx.productId).toBe("p1");
    expect(parsed.ts).toMatch(/T/);
  });

  it("mascara chaves sensíveis em qualquer profundidade", () => {
    const log = createLogger({ module: "auth" });
    log.info("token.issued", {
      user: { email: "a@b.com", password: "s3cret" },
      headers: { Authorization: "Bearer x", cookie: "sb=..." },
      apiKey: "sk-live-x",
    });
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.ctx.user.password).toBe("[REDACTED]");
    expect(parsed.ctx.headers.Authorization).toBe("[REDACTED]");
    expect(parsed.ctx.headers.cookie).toBe("[REDACTED]");
    expect(parsed.ctx.apiKey).toBe("[REDACTED]");
    expect(parsed.ctx.user.email).toBe("a@b.com");
  });

  it("span registra start + end + duração e propaga o valor", async () => {
    const log = createLogger({ module: "engine", correlationId: "c" });
    const res = await log.span("compute", { productId: "p" }, async () => 42);
    expect(res).toBe(42);
    expect(logs).toHaveLength(2);
    const end = JSON.parse(logs[1]!);
    expect(end.ok).toBe(true);
    expect(typeof end.durationMs).toBe("number");
    expect(end.event).toBe("compute");
  });

  it("span emite error e re-lança", async () => {
    const log = createLogger({ module: "engine" });
    await expect(
      log.span("compute", undefined, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const err = JSON.parse(logs[1]!);
    expect(err.level).toBe("error");
    expect(err.error?.message).toBe("boom");
    expect(err.ok).toBe(false);
  });

  it("child mescla contexto", () => {
    const parent = createLogger({ module: "app" });
    const child = parent.child({ correlationId: "c-2", userId: "u-1" });
    child.warn("x");
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.correlationId).toBe("c-2");
    expect(parsed.userId).toBe("u-1");
    expect(parsed.level).toBe("warn");
  });

  it("readOrCreateCorrelationId reutiliza header válido", () => {
    const req = new Request("http://x", {
      headers: { [CORRELATION_HEADER_NAME]: "nxs-abc-123456" },
    });
    expect(readOrCreateCorrelationId(req)).toBe("nxs-abc-123456");
  });

  it("readOrCreateCorrelationId rejeita header suspeito e gera novo", () => {
    const req = new Request("http://x", {
      headers: { [CORRELATION_HEADER_NAME]: "'; DROP TABLE users --" },
    });
    const id = readOrCreateCorrelationId(req);
    expect(id).toMatch(/^nxs-/);
    expect(id).not.toContain("DROP");
  });

  it("readOrCreateCorrelationId gera id sem request", () => {
    const id = readOrCreateCorrelationId();
    expect(id).toMatch(/^nxs-[a-z0-9]+-[a-z0-9]+$/);
  });
});
