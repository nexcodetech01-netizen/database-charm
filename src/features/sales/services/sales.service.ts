import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { updateRow } from "@/services/supabase.service";
import type { Tables } from "@/integrations/supabase/types";
import type {
  SaleInsert,
  SaleItemDraft,
  SaleListFilters,
  SaleUpdate,
  SaleWithItems,
  SaleWithMeta,
} from "../types";

import { computeItemTotal, computeTotals, computeItemMargin } from "../types";
import { applyDataScope, type DataScope } from "../lib/test-data-scope";
import {
  DEFAULT_SALE_ORIGIN,
  saleRequiresCustomer,
  type SaleOrigin,
} from "./sale-origin";
import { buildCostSnapshot } from "@/features/inventory/lib/ledger";
import {
  FISCAL_DELETE_BLOCKED_MESSAGE,
  FiscalDeleteBlockedError,
  findBlockingFiscalDocument,
} from "../lib/fiscal-delete-guard";

function getSupabaseErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  return "Não foi possível cancelar a venda.";
}

function buildItemRow(it: SaleItemDraft, saleId: string, idx: number) {
  const revenue = computeItemTotal(it);
  const gross = (it.quantity || 0) * (it.unit_price || 0);
  const applied_discount_pct = gross > 0 ? ((it.discount || 0) / gross) * 100 : 0;
  const { marginPct, profit } = computeItemMargin(it);
  const minMargin = it.min_margin_pct != null ? Number(it.min_margin_pct) : null;
  const below_min_margin =
    marginPct != null && minMargin != null ? marginPct < minMargin : null;

  // Snapshot imutável de custo (Sprint P0). O banco completa campos ausentes
  // a partir do produto, mas nunca sobrescreve o que foi gravado aqui.
  const cost = buildCostSnapshot({
    quantity: it.quantity,
    averageCost: it.average_cost ?? it.unit_cost ?? null,
    lastPurchaseCost: it.last_purchase_cost ?? null,
    unitCost: it.unit_cost ?? null,
    costMethod: it.cost_method ?? "average",
  });

  return {
    sale_id: saleId,
    product_id: it.product_id,
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unit_price,
    discount: it.discount,
    total: revenue,
    position: idx,
    // Snapshot imutável da Política Comercial no momento da venda
    unit_cost: cost.unit_cost,
    average_cost: cost.average_cost,
    last_purchase_cost: cost.last_purchase_cost,
    cost_method: cost.cost_method,
    total_cost: cost.total_cost,
    category_target_margin_pct: it.target_margin_pct ?? null,
    category_min_margin_pct: minMargin,
    category_default_discount_pct: it.default_discount_pct ?? null,
    applied_discount_pct: Number(applied_discount_pct.toFixed(3)),
    profit_snapshot: it.unit_cost != null ? Number(profit.toFixed(4)) : null,
    final_margin_pct: marginPct != null ? Number(marginPct.toFixed(3)) : null,
    below_min_margin,
  };
}

// ============================================================
// Validação Zod (P1.2) — bloqueia gravação de vendas inválidas.
// FKs obrigatórias e regra de negócio: venda ativa exige cliente.
// ============================================================
const saleItemSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, "Descrição do item é obrigatória."),
  quantity: z.number().positive("Quantidade deve ser maior que zero."),
  unit_price: z.number().nonnegative("Preço não pode ser negativo."),
  discount: z.number().nonnegative().optional(),
}).passthrough();

/**
 * Schema de criação por origem (RC2 / P0.2).
 *
 * A obrigatoriedade do cliente é decidida em um ÚNICO lugar
 * (`saleRequiresCustomer`) a partir da origem explícita da venda. O balcão
 * (PDV) grava consumidor final com `customer_id = null`; formulário,
 * marketplace, API e demais fluxos seguem exigindo cliente como hoje.
 */
export function buildSaleCreateSchema(origin: SaleOrigin = DEFAULT_SALE_ORIGIN) {
  return z
    .object({
      company_id: z.string().uuid("Empresa inválida."),
      customer_id: z.string().uuid().nullable().optional(),
      status: z.string().trim().min(1).optional(),
      items: z.array(saleItemSchema).min(1, "Inclua ao menos um item na venda."),
    })
    .passthrough()
    .superRefine((val, ctx) => {
      if (saleRequiresCustomer(origin, val.status) && !val.customer_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customer_id"],
          message: "Selecione um cliente para finalizar a venda.",
        });
      }
    });
}

export type SalesStatusBreakdownRow = {
  status: string;
  count: number;
  total: number;
};

/**
 * Conferência de recebimentos (somente leitura).
 * Índice reference_id (venda) -> paid_at real da liquidação financeira.
 * Fonte única: financial_transactions. Nenhuma regra financeira é recalculada.
 */
async function loadSettlementMap(
  companyId: string,
  saleIds?: string[],
): Promise<Map<string, string>> {
  let q = supabase
    .from("financial_transactions")
    .select("reference_id,paid_at")
    .eq("company_id", companyId)
    .eq("source", "sale")
    .not("reference_id", "is", null)
    .not("paid_at", "is", null);
  if (saleIds && saleIds.length > 0) q = q.in("reference_id", saleIds);
  const { data, error } = await q.limit(5000);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const ref = row.reference_id as string | null;
    const paidAt = row.paid_at as string | null;
    if (!ref || !paidAt) continue;
    const current = map.get(ref);
    // Mantém a liquidação mais recente quando houver mais de um lançamento.
    if (!current || new Date(paidAt).getTime() > new Date(current).getTime()) {
      map.set(ref, paidAt);
    }
  }
  return map;
}

/** Janela da sessão de caixa aberta da empresa (abertura -> agora). */
async function loadOpenSessionWindow(
  companyId: string,
): Promise<{ start: string; end: string } | null> {
  const { data, error } = await supabase
    .from("cash_sessions")
    .select("opened_at")
    .eq("company_id", companyId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const opened = data?.[0]?.opened_at as string | undefined;
  if (!opened) return null;
  return { start: opened, end: new Date().toISOString() };
}

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export const salesService = {
  async list(companyId: string, filters: SaleListFilters, scope?: DataScope) {
    // Busca em número/observações + nome do cliente. Primeiro resolvemos os
    // IDs de clientes cujo nome bate com a busca e injetamos via .in().
    const rawSearch = filters.search.trim();
    let searchCustomerIds: string[] | null = null;
    if (rawSearch) {
      const s = `%${rawSearch}%`;
      const { data: matchedCustomers, error: cErr } = await supabase
        .from("customers")
        .select("id")
        .eq("company_id", companyId)
        .ilike("name", s)
        .limit(500);
      if (cErr) throw cErr;
      searchCustomerIds = (matchedCustomers ?? []).map((c) => c.id);
    }

    // ---- Conferência de recebimentos: filtro/ordenação por paid_at ----
    const usesSettlement =
      filters.paymentStatus !== "" || filters.sortBy === "paid_at";
    let settlementMap: Map<string, string> | null = null;
    let includeIds: string[] | null = null;
    let excludeIds: string[] | null = null;

    if (usesSettlement) {
      settlementMap = await loadSettlementMap(companyId);

      if (filters.paymentStatus === "unpaid") {
        // Pendente = sem liquidação. Vendas sem lançamento também entram,
        // por isso usamos exclusão em vez de inclusão.
        excludeIds = Array.from(settlementMap.keys());
      } else if (filters.paymentStatus === "paid_today") {
        const from = startOfTodayISO();
        includeIds = Array.from(settlementMap.entries())
          .filter(([, paidAt]) => paidAt >= from)
          .map(([id]) => id);
      } else if (filters.paymentStatus === "paid_session") {
        const win = await loadOpenSessionWindow(companyId);
        includeIds = win
          ? Array.from(settlementMap.entries())
              .filter(
                ([, paidAt]) =>
                  new Date(paidAt).getTime() >= new Date(win.start).getTime() &&
                  new Date(paidAt).getTime() <= new Date(win.end).getTime(),
              )
              .map(([id]) => id)
          : [];
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyFilters = <T,>(builder: T): T => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = builder as any;
      if (rawSearch) {
        const s = `%${rawSearch}%`;
        const orParts = [`number.ilike.${s}`, `notes.ilike.${s}`];
        if (searchCustomerIds && searchCustomerIds.length > 0) {
          orParts.push(`customer_id.in.(${searchCustomerIds.join(",")})`);
        }
        q = q.or(orParts.join(","));
      }
      q = applyDataScope(q, scope);
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.customerId) q = q.eq("customer_id", filters.customerId);
      if (filters.paymentMethod)
        q = q.eq("payment_method", filters.paymentMethod);
      if (includeIds) q = q.in("id", includeIds);
      if (excludeIds && excludeIds.length > 0)
        q = q.not("id", "in", `(${excludeIds.join(",")})`);
      return q as T;
    };


    if (includeIds && includeIds.length === 0) {
      return { rows: [] as SaleWithMeta[], total: 0 };
    }

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;

    let rows: Record<string, unknown>[] = [];
    let total = 0;

    if (filters.sortBy === "paid_at") {
      // Postgrest não ordena por coluna de outra tabela: resolvemos os ids
      // filtrados, ordenamos pelo paid_at do índice e paginamos em memória.
      const { data: idRows, error: idErr, count } = await applyFilters(
        supabase
          .from("sales")
          .select("id", { count: "exact" })
          .eq("company_id", companyId),
      ).limit(1000);
      if (idErr) throw idErr;
      total = count ?? (idRows?.length ?? 0);

      const asc = filters.sortDir === "asc";
      const ordered = (idRows ?? [])
        .map((r) => ({
          id: r.id as string,
          paidAt: settlementMap?.get(r.id as string) ?? null,
        }))
        .sort((a, b) => {
          // Sem liquidação vai sempre para o fim da lista.
          if (!a.paidAt && !b.paidAt) return 0;
          if (!a.paidAt) return 1;
          if (!b.paidAt) return -1;
          const ta = new Date(a.paidAt).getTime();
          const tb = new Date(b.paidAt).getTime();
          return asc ? ta - tb : tb - ta;
        })
        .slice(from, to + 1)
        .map((r) => r.id);

      if (ordered.length === 0) return { rows: [], total };

      const { data: pageRows, error: pErr } = await supabase
        .from("sales")
        .select("*")
        .in("id", ordered);
      if (pErr) throw pErr;
      const byId = new Map((pageRows ?? []).map((r) => [r.id, r]));
      rows = ordered
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => !!r);
    } else {
      const { data, error, count } = await applyFilters(
        supabase
          .from("sales")
          .select("*", { count: "exact" })
          .eq("company_id", companyId),
      )
        .order(filters.sortBy, { ascending: filters.sortDir === "asc" })
        .range(from, to);
      if (error) throw error;
      rows = data ?? [];
      total = count ?? 0;
    }

    if (rows.length === 0) return { rows: [] as SaleWithMeta[], total };

    const customerIds = Array.from(
      new Set(
        rows
          .map((r) => r.customer_id as string | null)
          .filter((v): v is string => !!v),
      ),
    );
    let customerMap = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: cData, error: cErr } = await supabase
        .from("customers")
        .select("id,name")
        .in("id", customerIds);
      if (cErr) throw cErr;
      customerMap = new Map((cData ?? []).map((c) => [c.id, c.name]));
    }

    const ids = rows.map((r) => r.id as string);
    const { data: items, error: ierr } = await supabase
      .from("sale_items")
      .select("sale_id")
      .in("sale_id", ids);
    if (ierr) throw ierr;
    const counts = new Map<string, number>();
    (items ?? []).forEach((it) => {
      counts.set(it.sale_id, (counts.get(it.sale_id) ?? 0) + 1);
    });

    const paidMap = settlementMap ?? (await loadSettlementMap(companyId, ids));

    const withMeta = rows.map((r) => {
      const id = r.id as string;
      const customerId = r.customer_id as string | null;
      return {
        ...r,
        customer_name: customerId ? (customerMap.get(customerId) ?? null) : null,
        items_count: counts.get(id) ?? 0,
        settlement_paid_at: paidMap.get(id) ?? null,
      };
    }) as unknown as SaleWithMeta[];

    return { rows: withMeta, total };
  },


  /**
   * P1.1 — Agregação real no banco (GROUP BY status) via RPC dedicada.
   * Retorna array dinâmico — qualquer status persistido aparece aqui.
   */
  async statusBreakdown(
    companyId: string,
    range?: { from: string; to: string },
  ): Promise<SalesStatusBreakdownRow[]> {
    const { data, error } = await supabase.rpc("sales_status_breakdown", {
      _company_id: companyId,
      _from: range?.from ?? undefined,
      _to: range?.to ?? undefined,
    });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      status: String(r.status),
      count: Number(r.count ?? 0),
      total: Number(r.total ?? 0),
    }));
  },

  async metrics(
    companyId: string,
    range?: { from: string; to: string },
    scope?: DataScope,
  ) {
    // 1) KPIs por período (apenas vendas pagas)
    let kpiQuery = applyDataScope(
      supabase
        .from("sales")
        .select("status,grand_total,sale_date,created_at")
        .eq("company_id", companyId),
      scope,
    );
    if (range) {
      kpiQuery = kpiQuery.gte("sale_date", range.from).lte("sale_date", range.to);
    }
    const { data: kpiData, error: kpiErr } = await kpiQuery;
    if (kpiErr) throw kpiErr;

    const normalize = (s: unknown) => String(s ?? "").trim().toLowerCase();
    const kpiRows = (kpiData ?? []).map((r) => ({
      ...r,
      status: normalize(r.status),
    }));

    // P2.4 — data/mês vindos do servidor no fuso da empresa (não do browser).
    const [{ data: todayRpc }, { data: monthRpc }, { data: tzRpc }] = await Promise.all([
      supabase.rpc("company_today", { _company_id: companyId }),
      supabase.rpc("company_month_start", { _company_id: companyId }),
      supabase.rpc("company_timezone", { _company_id: companyId }),
    ]);
    const todayISO =
      (typeof todayRpc === "string" && todayRpc) ||
      new Date().toISOString().slice(0, 10);
    const monthStartISO =
      (typeof monthRpc === "string" && monthRpc) ||
      `${todayISO.slice(0, 7)}-01`;
    const timeZone =
      (typeof tzRpc === "string" && tzRpc) || "America/Sao_Paulo";

    // Data local (fuso da empresa) em que a venda foi efetivamente criada.
    const localDate = (iso: string | null | undefined) => {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      try {
        return new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
      } catch {
        return d.toISOString().slice(0, 10);
      }
    };

    const paid = kpiRows.filter((r) => r.status === "paid");
    // Receita do dia = vendas PAGAS criadas HOJE (created_at), não sale_date —
    // sale_date pode ser retroativo/futuro e inflava o card.
    const today = paid.filter(
      (r) => localDate((r as { created_at?: string }).created_at) === todayISO,
    );
    const month = paid.filter(
      (r) => !!r.sale_date && r.sale_date >= monthStartISO,
    );
    const monthTotal = month.reduce((s, r) => s + Number(r.grand_total ?? 0), 0);
    const paidTotal = paid.reduce((s, r) => s + Number(r.grand_total ?? 0), 0);

    // 2) Breakdown por status — RPC (GROUP BY real no banco).
    // Usa exatamente o mesmo intervalo dos KPIs para evitar divergência de período.
    const breakdown = await salesService.statusBreakdown(companyId, range);

    return {
      dayCount: today.length,
      dayTotal: today.reduce((s, r) => s + Number(r.grand_total ?? 0), 0),

      monthCount: month.length,
      monthTotal,
      averageTicket: month.length > 0 ? monthTotal / month.length : 0,
      paidTotal,
      range: range ?? null,
      breakdown,
    };
  },

  async get(id: string): Promise<SaleWithItems | null> {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const { data: items, error: ierr } = await supabase
      .from("sale_items")
      .select("*")
      .eq("sale_id", id)
      .order("position", { ascending: true });
    if (ierr) throw ierr;

    let customer_name: string | null = null;
    if (data.customer_id) {
      const { data: cus } = await supabase
        .from("customers")
        .select("name")
        .eq("id", data.customer_id)
        .maybeSingle();
      customer_name = cus?.name ?? null;
    }

    return { ...data, items: items ?? [], customer_name };
  },

  async listActiveCustomers(companyId: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("id,name")
      .eq("company_id", companyId)
      .neq("status", "archived")
      .order("name")
      .limit(500);
    if (error) throw error;
    return data ?? [];
  },

  async create(
    input: Omit<SaleInsert, "items_total" | "grand_total"> & {
      items: SaleItemDraft[];
    },
    /** Origem explícita da venda — define se o cliente é obrigatório. */
    options?: { origin?: SaleOrigin },
  ) {
    const origin = options?.origin ?? DEFAULT_SALE_ORIGIN;
    // ================= BUG-VENDA-PERSIST — trilha de auditoria =================
    // Logs temporários por etapa: ENTRADA → PAYLOAD → RESULTADO → ERRO → COMMIT.
    const trace = `sale-create:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    const log = (step: string, payload: unknown) =>
      // eslint-disable-next-line no-console
      console.info(`[${trace}] ${step}`, payload);

    log("ENTRADA", {
      company_id: input.company_id,
      number: input.number,
      customer_id: input.customer_id,
      origin,
      status: input.status,
      payment_method: input.payment_method,
      cash_session_id: input.cash_session_id,
      items: input.items?.length ?? 0,
    });

    // Cliente ausente chega como "" em alguns formulários: normaliza para
    // null antes de validar (o banco já aceita customer_id nulo).
    if (typeof input.customer_id === "string" && !input.customer_id.trim()) {
      input = { ...input, customer_id: null };
    }

    // Validação Zod antes de qualquer INSERT.
    const parsed = buildSaleCreateSchema(origin).safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(" · ");
      // eslint-disable-next-line no-console
      console.error(`[${trace}] ERRO validação`, parsed.error.issues);
      throw new Error(message);
    }
    const { items, ...header } = input;

    // Guarda dura: venda sem item nunca é considerada válida.
    if (!items || items.length === 0) {
      // eslint-disable-next-line no-console
      console.error(`[${trace}] ERRO sem itens`, { number: header.number });
      throw new Error("A venda precisa ter ao menos um item.");
    }

    // TZ-001 — nunca derivar sale_date de UTC no browser.
    // Se a data operacional ainda não chegou, envia null e deixa o trigger
    // `trg_set_sale_date_company_today` resolver via company_today().
    if (!header.sale_date) {
      delete (header as { sale_date?: string | null }).sale_date;
    }
    const totals = computeTotals(items, {
      discount: Number(header.discount ?? 0),
      shipping: Number(header.shipping ?? 0),
    });

    const headerPayload = { ...header, ...totals };
    log("PAYLOAD sales", headerPayload);

    const { data: created, error } = await supabase
      .from("sales")
      .insert(headerPayload)
      .select()
      .single();
    if (error || !created) {
      // eslint-disable-next-line no-console
      console.error(`[${trace}] ERRO insert sales`, {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      throw new Error(
        error ? getSupabaseErrorMessage(error) : "A venda não foi gravada.",
        { cause: error ?? undefined },
      );
    }
    log("RESULTADO sales", { id: created.id, number: created.number });

    const rows = items.map((it, idx) => buildItemRow(it, created.id, idx));
    log("PAYLOAD sale_items", { sale_id: created.id, count: rows.length });
    const { data: insertedItems, error: ierr } = await supabase
      .from("sale_items")
      .insert(rows)
      .select("id");
    if (ierr) {
      // eslint-disable-next-line no-console
      console.error(`[${trace}] ERRO insert sale_items`, {
        sale_id: created.id,
        code: ierr.code,
        message: ierr.message,
        details: ierr.details,
        hint: ierr.hint,
      });
      // Rollback lógico: sem itens a venda não existe para o negócio.
      try {
        await supabase.rpc("delete_sale", { _sale_id: created.id });
      } catch {
        /* melhor esforço */
      }
      throw new Error(getSupabaseErrorMessage(ierr), { cause: ierr });
    }
    log("RESULTADO sale_items", { inserted: insertedItems?.length ?? 0 });

    // COMMIT — a venda só é considerada concluída quando existe em `sales`
    // E possui ao menos um `sale_item` lidos de volta do banco.
    const { data: check, error: checkErr } = await supabase
      .from("sales")
      .select("id,number,sale_items(id)")
      .eq("id", created.id)
      .maybeSingle();
    const committedItems =
      (check as { sale_items?: { id: string }[] } | null)?.sale_items?.length ?? 0;
    if (checkErr || !check || committedItems === 0) {
      // eslint-disable-next-line no-console
      console.error(`[${trace}] ERRO commit não confirmado`, {
        sale_id: created.id,
        found: !!check,
        items: committedItems,
        error: checkErr?.message,
      });
      throw new Error(
        "A venda não foi confirmada no banco (venda ou itens ausentes).",
      );
    }
    log("COMMIT", {
      sale_id: created.id,
      number: check.number,
      items: committedItems,
    });

    return created;

  },

  async update(
    id: string,
    input: SaleUpdate & { items?: SaleItemDraft[] },
  ) {
    const { items, ...header } = input;
    // Edição nunca pode zerar a data operacional já gravada.
    if ("sale_date" in header && !header.sale_date) {
      delete (header as { sale_date?: string | null }).sale_date;
    }


    let totalsPatch: { items_total?: number; grand_total?: number } = {};
    if (items) {
      const totals = computeTotals(items, {
        discount: Number(header.discount ?? 0),
        shipping: Number(header.shipping ?? 0),
      });
      totalsPatch = totals;
    }

    const updated = await updateRow("sales", id, {
      ...(header as SaleUpdate),
      ...totalsPatch,
    });


    if (items) {
      const { error: delErr } = await supabase
        .from("sale_items")
        .delete()
        .eq("sale_id", id);
      if (delErr) throw delErr;

      if (items.length > 0) {
        const rows = items.map((it, idx) => buildItemRow(it, id, idx));
        const { error: ierr } = await supabase.from("sale_items").insert(rows);
        if (ierr) throw ierr;
      }
    }

    return updated;
  },

  async setStatus(id: string, status: string) {
    const patch: SaleUpdate = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    return updateRow("sales", id, patch);
  },

  /**
   * Lançamento financeiro em aberto gerado pela venda (source='sale').
   * Usado pela tela de Vendas para reaproveitar o fluxo de baixa do módulo
   * Financeiro (SettleTransactionDialog) — sem duplicar regra de negócio.
   */
  /**
   * FIN-BAIXA — Motor único de liquidação.
   * Garante (e retorna) o título da venda em Contas a Receber. Idempotente:
   * a RPC `ensure_sale_receivable` devolve o título em aberto existente ou
   * cria o pendente quando a venda ainda não possui lançamento (caso das
   * vendas à vista — dinheiro / PIX próprio / débito). Nenhuma baixa é feita
   * aqui: quem liquida é exclusivamente `settle_financial_transaction`.
   */
  async openReceivableForSale(saleId: string) {
    const { data, error } = await supabase.rpc("ensure_sale_receivable", {
      _sale_id: saleId,
    });
    if (error) throw new Error(getSupabaseErrorMessage(error), { cause: error });
    const tx = (Array.isArray(data) ? data[0] : data) as
      | Tables<"financial_transactions">
      | null;
    if (!tx) return null;
    // Título já baixado não deve reabrir o diálogo de recebimento.
    if (tx.status === "paid") return null;
    return tx;
  },



  async cancel(id: string, reason?: string | null) {
    const trimmed = (reason ?? "").trim();
    const { data, error } = await supabase.rpc("cancel_sale", {
      _sale_id: id,
      _reason: trimmed.length > 0 ? trimmed : null,
    });
    if (error) throw new Error(getSupabaseErrorMessage(error), { cause: error });
    if (!data) throw new Error("A venda não foi cancelada.");
    return data;
  },


  /**
   * Exclusão de venda. Passa obrigatoriamente pela RPC `delete_sale`, que
   * bloqueia vendas com liquidação/caixa/crediário e cancela o recebível
   * pendente — nunca deixando financial_transactions órfãs.
   *
   * Sprint P0.6.2: antes da RPC, a camada de negócio verifica se existe
   * documento fiscal vinculado em status protegido. Se existir, a exclusão
   * é bloqueada e a tentativa é registrada em `security_audit_log`.
   */
  async remove(id: string) {
    const { data: sale } = await supabase
      .from("sales")
      .select("id, company_id")
      .eq("id", id)
      .maybeSingle();

    const { data: docs, error: docsError } = await supabase
      .from("fiscal_documents")
      .select("id, status, number")
      .eq("sale_id", id);
    if (docsError) {
      throw new Error(getSupabaseErrorMessage(docsError), { cause: docsError });
    }

    const blocking = findBlockingFiscalDocument(docs ?? []);
    if (blocking) {
      const status = String(blocking.status ?? "");
      await logBlockedDeletion({
        companyId: sale?.company_id ?? null,
        saleId: id,
        documentId: blocking.id,
        documentStatus: status,
        documentNumber: blocking.number ?? null,
      });
      throw new FiscalDeleteBlockedError(blocking.id, status);
    }

    const { error } = await supabase.rpc("delete_sale", { _sale_id: id });
    if (error) throw new Error(getSupabaseErrorMessage(error), { cause: error });
  },
};

/** Registra a tentativa bloqueada. Best-effort: nunca derruba o fluxo. */
async function logBlockedDeletion(input: {
  companyId: string | null;
  saleId: string;
  documentId: string;
  documentStatus: string;
  documentNumber: number | string | null;
}) {
  if (!input.companyId) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)("log_security_audit", {
      _company_id: input.companyId,
      _action: "sale.delete.blocked",
      _module: "sales",
      _resource_table: "sales",
      _resource_id: input.saleId,
      _before: {
        sale_id: input.saleId,
        fiscal_document_id: input.documentId,
        fiscal_document_status: input.documentStatus,
        fiscal_document_number: input.documentNumber,
      },
      _after: null,
      _result: "denied",
      _error: FISCAL_DELETE_BLOCKED_MESSAGE,
    });
  } catch (err) {
    console.warn("[sales] falha ao registrar bloqueio de exclusão", err);
  }
}

