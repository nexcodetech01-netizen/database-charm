/**
 * Testes unitários das Skills v2 do módulo Products.
 * Usa mock do cliente Supabase (respeita o contrato de repositório).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import {
  productCreateSkill,
  productSearchSkill,
  productUpdatePriceSkill,
  productUpdateStockSkill,
  productListLowStockSkill,
} from "../skills";

type Row = Record<string, unknown>;

function makeSupabase(overrides: {
  selectRows?: Row[];
  count?: number;
  insertRow?: Row;
  updateRow?: Row;
  maybeSingle?: Row | null;
  singleForInsert?: Row;
} = {}) {
  const state = {
    lastTable: "" as string,
    lastInsert: null as unknown,
    lastUpdate: null as unknown,
  };

  const chain = () => {
    const c: Record<string, unknown> = {};
    const self = c as Record<string, (...args: unknown[]) => unknown>;
    const returnSelf = () => c;
    self.select = returnSelf;
    self.eq = returnSelf;
    self.or = returnSelf;
    self.order = returnSelf;
    self.limit = returnSelf;
    self.range = () =>
      Promise.resolve({
        data: overrides.selectRows ?? [],
        count: overrides.count ?? (overrides.selectRows?.length ?? 0),
        error: null,
      });
    self.maybeSingle = () =>
      Promise.resolve({ data: overrides.maybeSingle ?? null, error: null });
    self.single = () =>
      Promise.resolve({
        data: overrides.singleForInsert ?? overrides.insertRow ?? overrides.updateRow ?? {},
        error: null,
      });
    self.insert = (payload: unknown) => {
      state.lastInsert = payload;
      return c;
    };
    self.update = (payload: unknown) => {
      state.lastUpdate = payload;
      return c;
    };
    // Suporte a select().eq().limit()  (para listLowStock)
    return c;
  };

  const supabase = {
    from: (table: string) => {
      state.lastTable = table;
      return chain();
    },
  } as unknown as import("@supabase/supabase-js").SupabaseClient;

  return { supabase, state };
}

function makeCtx(perms: string[], supabase: unknown) {
  const ctx = buildExecutionContext({
    companyId: "c1",
    userId: "u1",
    permissions: new Set(perms),
    isOwner: false,
    channel: "debug",
  });
  return { ...ctx, supabase: supabase as never };
}

describe("ProductV2 Skills", () => {
  beforeEach(() => vi.clearAllMocks());

  it("product.create bloqueia sem permissão", async () => {
    const { supabase } = makeSupabase();
    const ctx = makeCtx([], supabase);
    const res = await productCreateSkill.run({
      payload: { name: "P", price: 10 },
      ctx,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("not_allowed");
  });

  it("product.create rejeita payload inválido (schema strict)", async () => {
    const { supabase } = makeSupabase();
    const ctx = makeCtx(["products.create"], supabase);
    const res = await productCreateSkill.run({
      payload: { name: "P", price: 10, campoDesconhecido: 1 },
      ctx,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("missing_fields");
  });

  it("product.create sucesso com dados válidos", async () => {
    const { supabase } = makeSupabase({
      insertRow: { id: "p1", name: "Caneta", price: 3.5 },
      singleForInsert: { id: "p1", name: "Caneta", price: 3.5 },
      maybeSingle: null,
    });
    const ctx = makeCtx(["products.create"], supabase);
    const res = await productCreateSkill.run({
      payload: { name: "Caneta", price: 3.5 },
      ctx,
    });
    expect(res.ok).toBe(true);
    expect(res.data).toMatchObject({ id: "p1" });
  });

  it("product.search sucesso vazio", async () => {
    const { supabase } = makeSupabase({ selectRows: [], count: 0 });
    const ctx = makeCtx(["products.view"], supabase);
    const res = await productSearchSkill.run({ payload: { query: "xxx" }, ctx });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/nenhum/i);
  });

  it("product.update_price exige confirmação", async () => {
    const { supabase } = makeSupabase();
    const ctx = makeCtx(["products.update"], supabase);
    const res = await productUpdatePriceSkill.run({
      payload: { productId: "00000000-0000-0000-0000-000000000001", price: 9 },
      ctx,
      // sem confirmed
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("invalid_payload"); // pipeline usa esse code p/ confirmação
    expect(res.message).toMatch(/confirmar/i);
  });

  it("product.update_stock rejeita quantidade zero", async () => {
    const { supabase } = makeSupabase();
    const ctx = makeCtx(["inventory.update"], supabase);
    const res = await productUpdateStockSkill.run({
      payload: {
        productId: "00000000-0000-0000-0000-000000000001",
        quantity: 0,
        type: "in",
      },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("missing_fields");
  });

  it("product.list_low_stock retorna mensagem amigável quando vazio", async () => {
    const { supabase } = makeSupabase({ selectRows: [] });
    const ctx = makeCtx(["inventory.view"], supabase);
    const res = await productListLowStockSkill.run({ payload: {}, ctx });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/nenhum produto/i);
  });
});
