import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { asaasFetch } from "../lib/asaas.server";

/**
 * Chaos test para timeout + retry (P1-01, P1-02).
 * Usa vi.stubGlobal("fetch", ...) para simular timeouts / 5xx / 4xx.
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function timeoutError(): Error {
  const e = new Error("The operation was aborted due to timeout");
  e.name = "TimeoutError";
  return e;
}

describe("asaasFetch chaos (P1-01/02)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sucesso na primeira tentativa (GET)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: "1" }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await asaasFetch<{ id: string }>({
      apiKey: "k",
      environment: "sandbox",
      path: "/myAccount",
      method: "GET",
    });
    expect(r.id).toBe("1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retry em HTTP 500 (GET) → sucesso na 2ª", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { message: "boom" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const p = asaasFetch({
      apiKey: "k",
      environment: "sandbox",
      path: "/x",
      method: "GET",
    });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retry em timeout (DELETE) até esgotar → lança", async () => {
    vi.useRealTimers();
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.reject(timeoutError()));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      asaasFetch({
        apiKey: "k",
        environment: "sandbox",
        path: "/payments/x",
        method: "DELETE",
        timeoutMs: 50,
      }),
    ).rejects.toThrow();
    // 1 tentativa + 2 retries = 3
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("POST não idempotente NÃO faz retry em 500", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(500, { message: "boom" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      asaasFetch({
        apiKey: "k",
        environment: "sandbox",
        path: "/payments",
        method: "POST",
        body: { foo: 1 },
      }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("POST idempotente=true faz retry em 5xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { message: "svc" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const p = asaasFetch({
      apiKey: "k",
      environment: "sandbox",
      path: "/customers",
      method: "POST",
      body: {},
      idempotent: true,
    });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("HTTP 4xx NÃO é reintentado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { message: "bad" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      asaasFetch({
        apiKey: "k",
        environment: "sandbox",
        path: "/x",
        method: "GET",
      }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("network error (TypeError) faz retry em GET", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const p = asaasFetch({
      apiKey: "k",
      environment: "sandbox",
      path: "/x",
      method: "GET",
    });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
