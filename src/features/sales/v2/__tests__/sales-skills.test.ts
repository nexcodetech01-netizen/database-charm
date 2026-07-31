/**
 * Sales v2 — Testes unitários das Skills (Sprint 005).
 * Cobre: RBAC, validação strict, confirmação destrutiva, cancelamento
 * via RPC, ranking de clientes e cálculo de margem.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildExecutionContext } from "@/features/bella-ai/agent/infrastructure/context";
import {
  saleCreateSkill,
  saleSearchSkill,
  saleCancelSkill,
  saleMarginSkill,
  saleBestCustomerSkill,
  saleQuoteSkill,
} from "../skills";

type Row = Record<string, unknown>;

function makeSupabase(
  opts: {
    productRows?: Row[];
    salesRows?: Row[];
    itemsRows?: Row[];
    customersRows?: Row[];
    inserted?: Row;
    maybeSingle?: Row | null;
    rpcData?: unknown;
    rpcError?: unknown;
  } = {},
) {
  const state = { lastTable: "" as string, lastRpc: "" as string, lastRpcArgs: null as unknown };

  const chain = () => {
    const c: Record<string, unknown> = {};
    const self = c as Record<string, unknown>;
    const returnSelf = () => c;
    self.select = returnSelf;
    self.eq = returnSelf;
    self.neq = returnSelf;
    self.gte = returnSelf;
    self.lte = returnSelf;
    self.in = returnSelf;
    self.not = returnSelf;
    self.or = returnSelf;
    self.order = returnSelf;
    self.limit = returnSelf;
    self.then = (resolve: (v: unknown) => unknown) => {
      let data: unknown[] = [];
      if (state.lastTable === "products") data = opts.productRows ?? [];
      else if (state.lastTable === "sales") data = opts.salesRows ?? [];
      else if (state.lastTable === "sale_items") data = opts.itemsRows ?? [];
      else if (state.lastTable === "customers") data = opts.customersRows ?? [];
      return Promise.resolve({ data, error: null }).then(resolve);
    };
    self.maybeSingle = () => Promise.resolve({ data: opts.maybeSingle ?? null, error: null });
    self.single = () => Promise.resolve({ data: opts.inserted ?? {}, error: null });
    self.insert = () => c;
    return c;
  };

  const supabase = {
    from: (table: string) => {
      state.lastTable = table;
      return chain();
    },
    rpc: (name: string, args: unknown) => {
      state.lastRpc = name;
      state.lastRpcArgs = args;
      return Promise.resolve({ data: opts.rpcData ?? null, error: opts.rpcError ?? null });
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

const PRODUCT = { id: "00000000-0000-0000-0000-0000000000aa", price: 100, cost: 40 };
const CUSTOMER_ID = "00000000-0000-0000-0000-0000000000bb";
const SALE_ID = "00000000-0000-0000-0000-0000000000cc";

describe("SalesV2 Skills", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sale.create bloqueia sem permissão sales.create", async () => {
    const { supabase } = makeSupabase();
    const ctx = makeCtx([], supabase);
    const res = await saleCreateSkill.run({
      payload: { items: [{ productId: PRODUCT.id, quantity: 1 }] },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("not_allowed");
  });

  it("sale.create rejeita payload com campo extra (strict)", async () => {
    const { supabase } = makeSupabase();
    const ctx = makeCtx(["sales.create"], supabase);
    const res = await saleCreateSkill.run({
      payload: {
        items: [{ productId: PRODUCT.id, quantity: 1 }],
        camposEstranhos: true,
      } as never,
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("missing_fields");
  });

  it("sale.create exige confirmação por ser destrutiva", async () => {
    const { supabase } = makeSupabase();
    const ctx = makeCtx(["sales.create"], supabase);
    const res = await saleCreateSkill.run({
      payload: { items: [{ productId: PRODUCT.id, quantity: 1 }] },
      ctx,
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/confirma/i);
  });

  it("sale.create sucesso (draft) — usa preço do produto e insere via RLS", async () => {
    const { supabase } = makeSupabase({
      productRows: [PRODUCT],
      inserted: {
        id: SALE_ID,
        number: "1",
        customer_id: null,
        status: "draft",
        items_total: 100,
        discount: 0,
        shipping: 0,
        grand_total: 100,
        sale_date: null,
        created_at: "2026-07-29",
      },
    });
    const ctx = makeCtx(["sales.create"], supabase);
    const res = await saleCreateSkill.run({
      payload: { items: [{ productId: PRODUCT.id, quantity: 1 }] },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/criad/i);
  });

  it("sale.quote não exige cliente e retorna sucesso", async () => {
    const { supabase } = makeSupabase({
      productRows: [PRODUCT],
      inserted: {
        id: SALE_ID,
        number: "2",
        status: "draft",
        items_total: 100,
        grand_total: 100,
      },
    });
    const ctx = makeCtx(["sales.create"], supabase);
    const res = await saleQuoteSkill.run({
      payload: { items: [{ productId: PRODUCT.id, quantity: 1 }] },
      ctx,
      confirmed: true,
    });
    expect(res.ok).toBe(true);
  });

  it("sale.search bloqueia sem permissão sales.view", async () => {
    const { supabase } = makeSupabase();
    const ctx = makeCtx([], supabase);
    const res = await saleSearchSkill.run({ payload: {}, ctx });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("not_allowed");
  });

  it("sale.search retorna vazio quando não há pedidos", async () => {
    const { supabase } = makeSupabase({ salesRows: [] });
    const ctx = makeCtx(["sales.view"], supabase);
    const res = await saleSearchSkill.run({ payload: { limit: 10 }, ctx });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/nenhum/i);
  });

  it("sale.cancel exige confirmação e chama RPC cancel_sale", async () => {
    const { supabase, state } = makeSupabase({
      maybeSingle: { id: SALE_ID, number: "9", status: "pending" },
      rpcData: {
        id: SALE_ID,
        number: "9",
        status: "cancelled",
        items_total: 0,
        discount: 0,
        shipping: 0,
        grand_total: 0,
      },
    });
    const ctx = makeCtx(["sales.delete"], supabase);
    const notConfirmed = await saleCancelSkill.run({
      payload: { saleId: SALE_ID, reason: "teste" },
      ctx,
    });
    expect(notConfirmed.ok).toBe(false);
    expect(notConfirmed.message).toMatch(/confirma/i);

    const ok = await saleCancelSkill.run({
      payload: { saleId: SALE_ID, reason: "teste" },
      ctx,
      confirmed: true,
    });
    expect(ok.ok).toBe(true);
    expect(state.lastRpc).toBe("cancel_sale");
  });

  it("sale.margin retorna zero quando não há itens no período", async () => {
    const { supabase } = makeSupabase({ itemsRows: [] });
    const ctx = makeCtx(["reports.view"], supabase);
    const res = await saleMarginSkill.run({
      payload: { dateFrom: "2026-07-01", dateTo: "2026-07-31" },
      ctx,
    });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/nenhum item/i);
  });

  it("sale.best_customer ranqueia clientes por receita", async () => {
    const { supabase } = makeSupabase({
      salesRows: [
        { customer_id: CUSTOMER_ID, grand_total: 500, customers: { name: "Cliente A" } },
        { customer_id: CUSTOMER_ID, grand_total: 300, customers: { name: "Cliente A" } },
      ],
    });
    const ctx = makeCtx(["reports.view"], supabase);
    const res = await saleBestCustomerSkill.run({ payload: { limit: 5 }, ctx });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/Cliente A/);
    expect(res.message).toMatch(/800\.00/);
  });
});
