import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordAudit, resolveCompanyId } = vi.hoisted(() => ({
  recordAudit: vi.fn(async (_supabase: unknown, _entry: Record<string, unknown>) => {}),
  resolveCompanyId: vi.fn(async () => "company-1"),
}));

vi.mock("@/lib/audit.server", () => ({ recordAudit }));
vi.mock("@/lib/company-resolver.server", () => ({ resolveCompanyId }));

import {
  ForbiddenError,
  hasServerPermission,
  requireAnyServerPermission,
  requireServerPermission,
} from "../server-guards";

type RpcResult = { data: unknown; error: unknown };

function ctx(results: RpcResult[] | RpcResult) {
  const queue = Array.isArray(results) ? [...results] : null;
  const rpc = vi.fn(async () => (queue ? (queue.shift() ?? { data: false, error: null }) : results));
  return {
    context: { supabase: { rpc } as never, userId: "user-1" },
    rpc,
  };
}

beforeEach(() => {
  recordAudit.mockClear();
  resolveCompanyId.mockClear();
});

describe("hasServerPermission", () => {
  it("retorna true somente quando a RPC responde true", async () => {
    const a = ctx({ data: true, error: null });
    await expect(
      hasServerPermission(a.context.supabase, "user-1", "company-1", "finance.create"),
    ).resolves.toBe(true);

    const b = ctx({ data: false, error: null });
    await expect(
      hasServerPermission(b.context.supabase, "user-1", "company-1", "finance.create"),
    ).resolves.toBe(false);
  });

  it("propaga erro da RPC (fail-closed)", async () => {
    const { context } = ctx({ data: null, error: new Error("boom") });
    await expect(
      hasServerPermission(context.supabase, "user-1", "company-1", "finance.create"),
    ).rejects.toThrow("boom");
  });
});

describe("requireServerPermission", () => {
  it("resolve a empresa ativa quando não informada", async () => {
    const { context, rpc } = ctx({ data: true, error: null });
    await expect(requireServerPermission(context, "products.update")).resolves.toEqual({
      companyId: "company-1",
    });
    expect(resolveCompanyId).toHaveBeenCalledWith(context.supabase, "user-1");
    expect(rpc).toHaveBeenCalledWith("has_permission", {
      _user_id: "user-1",
      _company_id: "company-1",
      _permission_code: "products.update",
    });
  });

  it("respeita companyId explícito sem resolver empresa ativa", async () => {
    const { context } = ctx({ data: true, error: null });
    await requireServerPermission(context, "products.update", { companyId: "company-9" });
    expect(resolveCompanyId).not.toHaveBeenCalled();
  });

  it("nega e registra auditoria quando falta permissão", async () => {
    const { context } = ctx({ data: false, error: null });
    await expect(requireServerPermission(context, "finance.delete")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(recordAudit).toHaveBeenCalledTimes(1);
    const entry = recordAudit.mock.calls[0]![1];
    expect(entry).toMatchObject({
      companyId: "company-1",
      result: "denied",
      module: "finance",
      error: "missing_permission:finance.delete",
    });
  });

  it("não audita sucesso por padrão e audita quando solicitado", async () => {
    const allowed = ctx({ data: true, error: null });
    await requireServerPermission(allowed.context, "sales.create");
    expect(recordAudit).not.toHaveBeenCalled();

    const audited = ctx({ data: true, error: null });
    await requireServerPermission(audited.context, "sales.create", { auditSuccess: true });
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit.mock.calls[0]![1]).toMatchObject({ result: "success" });
  });
});

describe("requireAnyServerPermission", () => {
  it("aceita quando qualquer permissão existe", async () => {
    const { context } = ctx([
      { data: false, error: null },
      { data: true, error: null },
    ]);
    await expect(
      requireAnyServerPermission(context, ["fiscal.manage", "fiscal.create"]),
    ).resolves.toEqual({ companyId: "company-1" });
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("nega e audita quando nenhuma permissão existe", async () => {
    const { context } = ctx([
      { data: false, error: null },
      { data: false, error: null },
    ]);
    await expect(
      requireAnyServerPermission(context, ["fiscal.manage", "fiscal.create"]),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(recordAudit.mock.calls[0]![1]).toMatchObject({
      result: "denied",
      error: "missing_permission:fiscal.manage|fiscal.create",
    });
  });
});
