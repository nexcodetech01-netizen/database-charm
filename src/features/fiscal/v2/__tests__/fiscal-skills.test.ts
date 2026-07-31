/**
 * Fiscal v2 — Smoke tests das Skills (Sprint 007).
 * Cobre schema estrito, permissões, ciclo emissão/cancelamento e busca.
 */
import { describe, it, expect, vi } from "vitest";
import type { ExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import {
  fiscalIssueSkill,
  fiscalStatusSkill,
  fiscalCancelSkill,
  fiscalSearchSkill,
  fiscalV2BaseSkills,
} from "../skills";

vi.mock("@/features/bella-ai/agent/infrastructure/event-bus", () => ({
  emitAgentEvent: vi.fn().mockResolvedValue(undefined),
}));

type Row = Record<string, unknown>;

function fakeSupabase(state: {
  sales?: Row[];
  fiscal_documents?: Row[];
  fiscal_events?: Row[];
}) {
  const tables: Record<string, Row[]> = {
    sales: state.sales ?? [],
    fiscal_documents: state.fiscal_documents ?? [],
    fiscal_events: state.fiscal_events ?? [],
  };
  return {
    from(table: string) {
      const rows = tables[table] ?? (tables[table] = []);
      const filters: Array<(r: Row) => boolean> = [];
      let pendingInsert: Row | null = null;
      let pendingUpdate: Row | null = null;
      const api: Record<string, unknown> = {};
      const self = api;
      self.select = () => self;
      self.eq = (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return self;
      };
      self.gte = (col: string, val: unknown) => {
        filters.push((r) => (r[col] as string) >= (val as string));
        return self;
      };
      self.lte = (col: string, val: unknown) => {
        filters.push((r) => (r[col] as string) <= (val as string));
        return self;
      };
      self.in = (col: string, vals: unknown[]) => {
        filters.push((r) => (vals as unknown[]).includes(r[col]));
        return self;
      };
      self.order = () => self;
      self.limit = () => self;
      self.insert = (row: Row) => {
        const now = new Date().toISOString();
        pendingInsert = {
          id: (row.id as string) ?? `id-${rows.length + 1}-${table}`,
          created_at: now,
          updated_at: now,
          ...row,
        };
        rows.push(pendingInsert);
        return self;
      };
      self.update = (patch: Row) => {
        pendingUpdate = patch;
        return self;
      };
      self.single = async () => {
        if (pendingInsert) return { data: pendingInsert, error: null };
        if (pendingUpdate) {
          const target = rows.find((r) => filters.every((f) => f(r)));
          if (target) Object.assign(target, pendingUpdate);
          return { data: target ?? null, error: null };
        }
        const filtered = rows.filter((r) => filters.every((f) => f(r)));
        return { data: filtered[0] ?? null, error: null };
      };
      self.maybeSingle = async () => {
        const filtered = rows.filter((r) => filters.every((f) => f(r)));
        return { data: filtered[0] ?? null, error: null };
      };
      self.then = (resolve: (r: unknown) => unknown) => {
        const filtered = rows.filter((r) => filters.every((f) => f(r)));
        return Promise.resolve({ data: filtered, error: null }).then(resolve);
      };
      return self;
    },
    rpc: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
  };
}

function makeCtx(supabase: unknown): ExecutionContext {
  return {
    supabase: supabase as ExecutionContext["supabase"],
    companyId: "company-1",
    userId: "user-1",
    request: {
      requestId: "req-1",
      channel: "test",
      source: "test",
      correlationId: null,
    },
    security: {
      permissions: ["fiscal.view", "fiscal.create", "fiscal.cancel"],
      roles: ["admin"],
      can: () => true,
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    },
  } as unknown as ExecutionContext;
}

describe("Fiscal v2 Skills — smoke", () => {
  it("expõe as 4 skills obrigatórias", () => {
    const ids = fiscalV2BaseSkills.map((s) => s.spec.id).sort();
    expect(ids).toEqual(["fiscal.cancel", "fiscal.issue", "fiscal.search", "fiscal.status"]);
  });

  it("fiscal.issue interrompe a emissão quando o CRT não está configurado", async () => {
    const ctx = makeCtx(
      fakeSupabase({
        sales: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            company_id: "company-1",
            total_amount: 100,
            customer_id: null,
          },
        ],
      }),
    );
    const res = await fiscalIssueSkill.run({
      payload: { saleId: "11111111-1111-1111-1111-111111111111" },
      ctx,
      confirmed: true,
    });
    // Sem `fiscal_settings.crt` a emissão NUNCA assume CRT=1.
    expect(res.ok).toBe(false);
    expect(String(res.message)).toMatch(/CRT da empresa não configurado/i);
  });


  it("fiscal.issue exige confirmação humana (destructive)", async () => {
    const ctx = makeCtx(fakeSupabase({ sales: [] }));
    const res = await fiscalIssueSkill.run({
      payload: { saleId: "11111111-1111-1111-1111-111111111111" },
      ctx,
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/Emitir NF-e/);
  });

  it("fiscal.search retorna mensagem vazia quando não há documentos", async () => {
    const ctx = makeCtx(fakeSupabase({}));
    const res = await fiscalSearchSkill.run({ payload: {}, ctx });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/Nenhuma NF-e/);
  });

  it("fiscal.search lista documentos existentes", async () => {
    const ctx = makeCtx(
      fakeSupabase({
        fiscal_documents: [
          {
            id: "doc-1",
            company_id: "company-1",
            sale_id: null,
            number: 42,
            series: 1,
            access_key: null,
            status: "authorized",
            environment: "homolog",
            total_amount: 250,
            xml_signed_path: null,
            xml_authorized_path: null,
            danfe_path: null,
            protocol: "PROTO-1",
            protocol_at: null,
            cancelled_at: null,
            cancellation_reason: null,
            cancellation_protocol: null,
            rejection_code: null,
            rejection_reason: null,
            provider: "mock",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    const res = await fiscalSearchSkill.run({ payload: { status: "authorized" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/nº 42/);
  });

  it("fiscal.status responde vazio quando o critério não bate", async () => {
    const ctx = makeCtx(fakeSupabase({}));
    const res = await fiscalStatusSkill.run({
      payload: { documentId: "11111111-1111-1111-1111-111111111111" },
      ctx,
    });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/Nenhuma NF-e/);
  });

  it("fiscal.status exige pelo menos um critério (schema)", async () => {
    const ctx = makeCtx(fakeSupabase({}));
    const res = await fiscalStatusSkill.run({ payload: {}, ctx });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("missing_fields");
  });

  it("fiscal.cancel confirma antes de executar (destructive)", async () => {
    const ctx = makeCtx(fakeSupabase({}));
    const res = await fiscalCancelSkill.run({
      payload: {
        documentId: "11111111-1111-1111-1111-111111111111",
        reason: "Erro de digitação no destinatário",
      },
      ctx,
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/Cancelar NF-e/);
  });

  it("fiscal.cancel falha com estado inválido", async () => {
    const ctx = makeCtx(
      fakeSupabase({
        fiscal_documents: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            company_id: "company-1",
            sale_id: null,
            number: 1,
            series: 1,
            access_key: null,
            status: "draft",
            environment: "homologation",
            total_amount: 10,
            provider_id: "mock",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );
    const res = await fiscalCancelSkill.run({
      payload: {
        documentId: "22222222-2222-2222-2222-222222222222",
        reason: "Motivo suficientemente longo para validar",
      },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/autorizada/);
  });

  it("schema estrito rejeita campos desconhecidos", async () => {
    const ctx = makeCtx(fakeSupabase({}));
    const res = await fiscalSearchSkill.run({
      payload: { foo: "bar" } as unknown as Record<string, unknown>,
      ctx,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("missing_fields");
  });
});
