import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRequest } = vi.hoisted(() => ({
  getRequest: vi.fn<() => Request | undefined>(() => undefined),
}));

vi.mock("@tanstack/react-start/server", () => ({ getRequest }));

import { recordAudit } from "../audit.server";

type RpcArgs = Record<string, unknown>;

function client(error: { message: string } | null = null) {
  const rpc = vi.fn(async (_fn: string, _args: RpcArgs) => ({ data: null, error }));
  return { rpc } as never as Parameters<typeof recordAudit>[0] & {
    rpc: typeof rpc;
  };
}

beforeEach(() => {
  getRequest.mockReturnValue(undefined);
  vi.restoreAllMocks();
});

describe("recordAudit", () => {
  it("grava a trilha completa via log_security_audit", async () => {
    const supabase = client();
    await recordAudit(supabase, {
      companyId: "company-1",
      action: "finance.transaction.create",
      module: "finance",
      resourceTable: "financial_transactions",
      resourceId: "tx-1",
      before: null,
      after: { amount: 100 },
      result: "success",
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = supabase.rpc.mock.calls[0]!;
    expect(fn).toBe("log_security_audit");
    expect(args).toMatchObject({
      _company_id: "company-1",
      _action: "finance.transaction.create",
      _module: "finance",
      _resource_table: "financial_transactions",
      _resource_id: "tx-1",
      _after: { amount: 100 },
      _result: "success",
      _error: null,
    });
  });

  it("mascara segredos e PII nos payloads", async () => {
    const supabase = client();
    await recordAudit(supabase, {
      companyId: "company-1",
      action: "integration.update",
      module: "integrations",
      after: { token: "abc123", nested: { password: "hunter2", keep: "ok" } },
    });
    const args = supabase.rpc.mock.calls[0]![1] as Record<string, Record<string, unknown>>;
    expect(args._after).toEqual({
      token: "[REDACTED]",
      nested: { password: "[REDACTED]", keep: "ok" },
    });
  });

  it("extrai IP, user-agent e correlation-id do request", async () => {
    getRequest.mockReturnValue(
      new Request("https://app.example.com/x", {
        headers: {
          "cf-connecting-ip": "203.0.113.10",
          "user-agent": "NexOS/1.0",
          "x-nexos-correlation-id": "nxs-abc-123456",
        },
      }),
    );
    const supabase = client();
    await recordAudit(supabase, { companyId: null, action: "a", module: "core" });
    expect(supabase.rpc.mock.calls[0]![1]).toMatchObject({
      _ip: "203.0.113.10",
      _user_agent: "NexOS/1.0",
      _correlation_id: "nxs-abc-123456",
    });
  });

  it("usa result 'success' como padrão e aceita 'denied'", async () => {
    const a = client();
    await recordAudit(a, { companyId: null, action: "a", module: "core" });
    expect(a.rpc.mock.calls[0]![1]).toMatchObject({ _result: "success" });

    const b = client();
    await recordAudit(b, {
      companyId: "c",
      action: "a",
      module: "core",
      result: "denied",
      error: "missing_permission:x",
    });
    expect(b.rpc.mock.calls[0]![1]).toMatchObject({
      _result: "denied",
      _error: "missing_permission:x",
    });
  });

  it("nunca lança quando a auditoria falha", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      recordAudit(client({ message: "rls" }), { companyId: null, action: "a", module: "core" }),
    ).resolves.toBeUndefined();

    const throwing = { rpc: () => Promise.reject(new Error("down")) } as never as Parameters<
      typeof recordAudit
    >[0];
    await expect(
      recordAudit(throwing, { companyId: null, action: "a", module: "core" }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
