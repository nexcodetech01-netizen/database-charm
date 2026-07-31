/**
 * Testes unitários das Skills v2 do módulo Estoque (Sprint 003).
 * Cobre: permissões, validação strict, confirmação destrutiva,
 * lookup por SKU/nome, listagem de estoque crítico.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import {
  stockAddSkill,
  stockRemoveSkill,
  stockAdjustSkill,
  stockHistorySkill,
  stockLowSkill,
  stockBalanceSkill,
} from "../skills";

type Row = Record<string, unknown>;

function makeSupabase(
  opts: {
    productRows?: Row[];
    productMaybe?: Row | null;
    movements?: Row[];
    insertRow?: Row;
  } = {},
) {
  const state = {
    lastTable: "" as string,
    lastInsert: null as unknown,
  };

  const chain = () => {
    const c: Record<string, unknown> = {};
    const self = c as Record<string, unknown>;
    const returnSelf = () => c;
    self.select = returnSelf;
    self.eq = returnSelf;
    self.ilike = returnSelf;
    self.or = returnSelf;
    self.gte = returnSelf;
    self.lte = returnSelf;
    self.order = returnSelf;
    self.limit = returnSelf;
    // Torna o chain "thenable" — cobre awaits terminais como
    // `await supabase.from(...).select(...).limit(...)` (listLowStock).
    self.then = (resolve: (v: unknown) => unknown) => {
      const data =
        state.lastTable === "products" ? (opts.productRows ?? []) : (opts.movements ?? []);
      return Promise.resolve({ data, error: null }).then(resolve);
    };
    self.maybeSingle = () => Promise.resolve({ data: opts.productMaybe ?? null, error: null });
    self.single = () => Promise.resolve({ data: opts.insertRow ?? {}, error: null });
    self.insert = (payload: unknown) => {
      state.lastInsert = payload;
      return c;
    };
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

const PRODUCT = {
  id: "00000000-0000-0000-0000-0000000000aa",
  name: "Cabo USB-C",
  sku: "CAB-USB",
  unit: "un",
  stock: 10,
  min_stock: 5,
  cost: 1,
  status: "active",
};

describe("StockV2 Skills", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stock.add bloqueia sem permissão", async () => {
    const { supabase } = makeSupabase();
    const ctx = makeCtx([], supabase);
    const res = await stockAddSkill.run({
      payload: { productId: PRODUCT.id, quantity: 5 },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("not_allowed");
  });

  it("stock.add rejeita payload inválido (strict)", async () => {
    const { supabase } = makeSupabase();
    const ctx = makeCtx(["inventory.update"], supabase);
    const res = await stockAddSkill.run({
      payload: { productId: PRODUCT.id, quantity: 5, algoEstranho: 1 },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("missing_fields");
  });

  it("stock.add exige confirmação por ser destrutiva", async () => {
    const { supabase } = makeSupabase({ productMaybe: PRODUCT });
    const ctx = makeCtx(["inventory.update"], supabase);
    const res = await stockAddSkill.run({
      payload: { query: "Cabo USB-C", quantity: 5 },
      ctx,
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/confirma/i);
  });

  it("stock.add sucesso com confirmação e resolução por SKU/nome", async () => {
    const { supabase } = makeSupabase({
      productMaybe: PRODUCT,
      insertRow: { id: "m1", type: "in", quantity: 5 },
    });
    const ctx = makeCtx(["inventory.update"], supabase);
    const res = await stockAddSkill.run({
      payload: { query: "Cabo USB-C", quantity: 5 },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/entrada de 5/i);
  });

  it("stock.remove aceita ordem de saída válida", async () => {
    const { supabase } = makeSupabase({
      productMaybe: PRODUCT,
      insertRow: { id: "m2", type: "out", quantity: 3 },
    });
    const ctx = makeCtx(["inventory.update"], supabase);
    const res = await stockRemoveSkill.run({
      payload: { productId: PRODUCT.id, quantity: 3 },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(true);
  });

  it("stock.adjust rejeita delta zero", async () => {
    const { supabase } = makeSupabase({ productMaybe: PRODUCT });
    const ctx = makeCtx(["inventory.update"], supabase);
    const res = await stockAdjustSkill.run({
      payload: { productId: PRODUCT.id, delta: 0 },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("missing_fields");
  });

  it("stock.adjust aceita delta negativo (redução)", async () => {
    const { supabase } = makeSupabase({
      productMaybe: PRODUCT,
      insertRow: { id: "m3", type: "adjustment", quantity: -2 },
    });
    const ctx = makeCtx(["inventory.update"], supabase);
    const res = await stockAdjustSkill.run({
      payload: { productId: PRODUCT.id, delta: -2 },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(true);
  });

  it("stock.history retorna mensagem amigável quando vazio", async () => {
    const { supabase } = makeSupabase({ productMaybe: PRODUCT, movements: [] });
    const ctx = makeCtx(["inventory.view"], supabase);
    const res = await stockHistorySkill.run({
      payload: { productId: PRODUCT.id },
      ctx,
    });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/sem movimenta/i);
  });

  it("stock.low retorna mensagem quando não há produtos abaixo do mínimo", async () => {
    const { supabase } = makeSupabase({ productRows: [] });
    const ctx = makeCtx(["inventory.view"], supabase);
    const res = await stockLowSkill.run({ payload: {}, ctx });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/nenhum produto/i);
  });

  it("stock.balance devolve saldo, mínimo e status", async () => {
    const { supabase } = makeSupabase({ productMaybe: PRODUCT });
    const ctx = makeCtx(["inventory.view"], supabase);
    const res = await stockBalanceSkill.run({
      payload: { productId: PRODUCT.id },
      ctx,
    });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/Cabo USB-C: 10/);
  });
});
