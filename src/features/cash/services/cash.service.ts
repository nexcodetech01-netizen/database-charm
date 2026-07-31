import { supabase } from "@/integrations/supabase/client";
import type {
  CashByMethod,
  CashMovement,
  CashPaymentMethodKey,
  CashSession,
  CashSummary,
  CloseSessionInput,
  OpenSessionInput,
  RegisterMovementInput,
} from "../types";
import { emptyByMethod } from "../types";
import { isSessionStale, staleSessionMessage } from "../lib/session-day";


const METHOD_KEYS: CashPaymentMethodKey[] = [
  "cash",
  "pix",
  "credit_card",
  "debit_card",
  "payment_link",
];

/**
 * ETAPA 3 — vocabulário único de formas de pagamento do Caixa.
 * Todo apelido gravado por PDV / Bella Pay / baixas financeiras é traduzido
 * para uma chave canônica. PIX nunca pode cair em "other".
 */
const METHOD_ALIASES: Record<string, CashPaymentMethodKey> = {
  // dinheiro
  dinheiro: "cash",
  money: "cash",
  especie: "cash",
  // pix
  pix_manual: "pix",
  pix_gateway: "pix",
  pix_qr: "pix",
  bella_pay: "pix",
  // cartão
  card: "credit_card",
  card_gateway: "credit_card",
  cartao: "credit_card",
  cartao_credito: "credit_card",
  credito: "credit_card",
  cartao_debito: "debit_card",
  debito: "debit_card",
  // link
  link: "payment_link",
  link_pagamento: "payment_link",
};

export function normalizeMethod(raw: string | null): CashPaymentMethodKey | "other" {
  if (!raw) return "other";
  const key = raw.trim().toLowerCase();
  if ((METHOD_KEYS as string[]).includes(key)) return key as CashPaymentMethodKey;
  return METHOD_ALIASES[key] ?? "other";
}

/** Somente dinheiro físico movimenta a gaveta. */
function isPhysicalCash(raw: string | null): boolean {
  return normalizeMethod(raw) === "cash";
}

/**
 * Movimentos gerados automaticamente pelo motor financeiro (RPCs oficiais):
 * `settle_financial_transaction`, `reverse_financial_transaction` e
 * `complete_settlement_data`. São informativos para a conferência de caixa —
 * aparecem no histórico, mas não alteram dinheiro esperado, suprimentos ou
 * sangrias.
 */
const SETTLEMENT_REASONS = new Set<string>([
  "baixa financeira",
  "saneamento de baixa",
  "estorno de baixa financeira",
]);
function isSettlementMovement(m: CashMovement): boolean {
  return SETTLEMENT_REASONS.has((m.reason ?? "").trim().toLowerCase());
}



export const cashService = {
  async getOpenSession(companyId: string, operatorId: string) {
    const { data, error } = await supabase
      .from("cash_sessions")
      .select("*")
      .eq("company_id", companyId)
      .eq("operator_id", operatorId)
      .eq("status", "open")
      .maybeSingle();
    if (error) throw error;
    return data as CashSession | null;
  },

  async listSessions(companyId: string, limit = 30) {
    const { data, error } = await supabase
      .from("cash_sessions")
      .select("*")
      .eq("company_id", companyId)
      .order("opened_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as CashSession[];
  },

  async getSession(id: string) {
    const { data, error } = await supabase
      .from("cash_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as CashSession | null;
  },

  async openSession(input: OpenSessionInput): Promise<CashSession> {
    // Guarda de negócio: 1 caixa aberto por operador (garantido também por
    // unique index parcial no banco). Além disso, aplica a regra de
    // fechamento diário — um caixa aberto em um dia anterior precisa ser
    // fechado antes de abrir um novo.
    const existing = await this.getOpenSession(input.companyId, input.operatorId);
    if (existing) {
      if (isSessionStale(existing)) {
        throw new Error(staleSessionMessage(existing));
      }
      throw new Error("Já existe um caixa aberto para este operador.");
    }

    const { data, error } = await supabase
      .from("cash_sessions")
      .insert({
        company_id: input.companyId,
        operator_id: input.operatorId,
        operator_name: input.operatorName,
        opening_balance: input.openingBalance,
        opening_note: input.openingNote ?? null,
        status: "open",
      })
      .select()
      .single();
    if (error) throw error;
    return data as CashSession;
  },

  async listMovements(sessionId: string): Promise<CashMovement[]> {
    const { data, error } = await supabase
      .from("cash_movements")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CashMovement[];
  },

  async registerMovement(input: RegisterMovementInput): Promise<CashMovement> {
    if (input.amount <= 0) throw new Error("Valor deve ser maior que zero.");
    if (!input.reason.trim()) throw new Error("Informe o motivo.");
    const { data, error } = await supabase
      .from("cash_movements")
      .insert({
        session_id: input.sessionId,
        company_id: input.companyId,
        type: input.type,
        amount: input.amount,
        reason: input.reason.trim(),
        note: input.note?.trim() || null,
        created_by: input.createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    return data as CashMovement;
  },

  /**
   * Apura o resumo da sessão em TRÊS blocos independentes (ETAPA 3):
   *
   *  A) Vendas da sessão        → `sales` (cash_session_id = sessão, status paid)
   *  B) Recebimentos na sessão  → `financial_transactions` pagas dentro da janela
   *  C) Movimentações de caixa  → `cash_movements` da sessão
   *
   * Nenhuma regra financeira é recalculada — apenas leitura e agregação.
   *
   * HOTFIX-002: o bloco A é sempre isolado por `cash_session_id`. Nunca
   * usar `company_id + intervalo` como filtro principal para evitar
   * misturar vendas de operadores distintos com caixas simultâneos.
   *
   * Dinheiro esperado considera SOMENTE dinheiro físico:
   *   abertura + vendas em dinheiro (A) + recebimentos em dinheiro (B)
   *            + suprimentos manuais (C) − sangrias manuais (C)
   * Movimentos automáticos de "Baixa financeira" (C) são informativos: o valor
   * já é contado por A ou B, e PIX/cartão/gateway nunca elevam a gaveta.
   */
  async computeSummary(
    session: CashSession,
    options?: { includeTest?: boolean },
  ): Promise<CashSummary> {
    // Isolamento de homologação: por padrão o caixa ignora vendas de teste
    // (sales.is_test = true, marcadas pela emissão de NF-e em homologação).
    const includeTest = options?.includeTest ?? false;
    const windowStart = session.opened_at;
    // A baixa financeira grava `paid_at` como data + 12h, que pode ficar à
    // frente do "agora". Com a sessão aberta, a janela vai até o fim do dia
    // corrente para não perder recebimentos do próprio dia.
    const endOfToday = (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.toISOString();
    })();
    const windowEnd = session.closed_at ?? endOfToday;


    const receiptColumns =
      "id,description,amount,payment_method,account_id,paid_at,type,source,reference_id,settlement_session_id";

    const [salesRes, movementsRes, receiptsRes, pinnedReceiptsRes, paymentsRes, pinnedPaymentsRes] =
      await Promise.all([
      supabase
        .from("sales")
        .select(
          "id,number,payment_method,grand_total,paid_at,status,cash_session_id,is_test",
        )
        .eq("cash_session_id", session.id)
        .eq("status", "paid"),
      supabase
        .from("cash_movements")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("financial_transactions")
        .select(receiptColumns)
        .eq("company_id", session.company_id)
        .eq("status", "paid")
        .eq("type", "income")
        .gte("paid_at", windowStart)
        .lte("paid_at", windowEnd)
        .order("paid_at", { ascending: false }),
      // Regularização de legado: liquidações fixadas manualmente nesta sessão
      // (settlement_session_id), independentemente do paid_at original.
      supabase
        .from("financial_transactions")
        .select(receiptColumns)
        .eq("company_id", session.company_id)
        .eq("status", "paid")
        .eq("type", "income")
        .eq("settlement_session_id", session.id),
      // AUDITORIA FINANCEIRA — pagamentos (despesas) liquidados na janela da
      // sessão. Dinheiro que SAI da gaveta precisa reduzir o esperado.
      supabase
        .from("financial_transactions")
        .select(receiptColumns)
        .eq("company_id", session.company_id)
        .eq("status", "paid")
        .eq("type", "expense")
        .gte("paid_at", windowStart)
        .lte("paid_at", windowEnd),
      supabase
        .from("financial_transactions")
        .select(receiptColumns)
        .eq("company_id", session.company_id)
        .eq("status", "paid")
        .eq("type", "expense")
        .eq("settlement_session_id", session.id),
    ]);
    if (salesRes.error) throw salesRes.error;
    if (movementsRes.error) throw movementsRes.error;
    if (receiptsRes.error) throw receiptsRes.error;
    if (pinnedReceiptsRes.error) throw pinnedReceiptsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    if (pinnedPaymentsRes.error) throw pinnedPaymentsRes.error;


    // ---------- Bloco A · Vendas da sessão ----------
    const byMethod: CashByMethod = emptyByMethod();
    let salesTotal = 0;
    let salesCount = 0;
    const sales: CashSummary["sales"] = [];
    const sessionSaleIds = new Set<string>();
    const testSaleIds = new Set<string>();
    let salesTotalProduction = 0;
    let salesTotalTest = 0;
    let testSalesCount = 0;

    for (const row of salesRes.data ?? []) {
      const amount = Number(row.grand_total ?? 0);
      if ((row as { is_test?: boolean }).is_test) {
        testSaleIds.add(row.id);
        salesTotalTest += amount;
        testSalesCount += 1;
      } else {
        salesTotalProduction += amount;
      }
    }

    const visibleSales = (salesRes.data ?? []).filter(
      (row) => includeTest || !(row as { is_test?: boolean }).is_test,
    );

    for (const sale of visibleSales) {
      const key = normalizeMethod(sale.payment_method);
      const amount = Number(sale.grand_total ?? 0);
      byMethod[key].count += 1;
      byMethod[key].total += amount;
      salesTotal += amount;
      salesCount += 1;
      sessionSaleIds.add(sale.id);
      sales.push({
        id: sale.id,
        number: (sale as { number?: string | null }).number ?? null,
        paid_at: sale.paid_at,
        payment_method: sale.payment_method,
        grand_total: amount,
        is_test: Boolean((sale as { is_test?: boolean }).is_test),
      });
    }

    sales.sort((a, b) => {
      const ta = a.paid_at ? new Date(a.paid_at).getTime() : 0;
      const tb = b.paid_at ? new Date(b.paid_at).getTime() : 0;
      return tb - ta;
    });

    // ---------- Bloco B · Recebimentos realizados na sessão ----------
    // HOTFIX — Fechamento operacional: o bloco lista TODAS as liquidações
    // ocorridas na janela da sessão, inclusive as das vendas emitidas nesta
    // mesma sessão. Venda paga na hora e baixa de conta a receber são eventos
    // distintos e ambos precisam ser conferidos aqui. Nenhum filtro por
    // reference_id.
    const receiptsByMethod: CashByMethod = emptyByMethod();
    const receipts: CashSummary["receipts"] = [];
    let receiptsTotal = 0;
    // Vendas da sessão que já possuem liquidação registrada na janela —
    // usado somente para não somar o mesmo dinheiro duas vezes na gaveta.
    const settledSessionSaleIds = new Set<string>();

    type ReceiptRow = (typeof receiptsRes.data extends (infer R)[] | null ? R : never);
    const mergedReceipts = new Map<string, ReceiptRow>();
    for (const tx of (receiptsRes.data ?? []) as ReceiptRow[]) {
      const pinned = (tx as { settlement_session_id?: string | null }).settlement_session_id ?? null;
      // Liquidação fixada em OUTRA sessão não pertence a esta janela.
      if (pinned && pinned !== session.id) continue;
      mergedReceipts.set(tx.id, tx);
    }
    for (const tx of (pinnedReceiptsRes.data ?? []) as ReceiptRow[]) {
      mergedReceipts.set(tx.id, tx);
    }

    const testTransactionIds = new Set<string>();
    for (const tx of mergedReceipts.values()) {
      const refId = (tx as { reference_id?: string | null }).reference_id ?? null;
      const isTestReceipt = Boolean(refId && testSaleIds.has(refId));
      if (isTestReceipt) testTransactionIds.add(tx.id);
      if (isTestReceipt && !includeTest) continue;
      if (refId && sessionSaleIds.has(refId)) settledSessionSaleIds.add(refId);
      const amount = Number(tx.amount ?? 0);
      const key = normalizeMethod(tx.payment_method);
      receiptsByMethod[key].count += 1;
      receiptsByMethod[key].total += amount;
      receiptsTotal += amount;
      receipts.push({
        id: tx.id,
        description: tx.description ?? null,
        amount,
        payment_method: tx.payment_method ?? null,
        paid_at: tx.paid_at,
        source: (tx as { source?: string | null }).source ?? null,
        is_test: isTestReceipt,
      });
    }
    receipts.sort((a, b) => {
      const ta = a.paid_at ? new Date(a.paid_at).getTime() : 0;
      const tb = b.paid_at ? new Date(b.paid_at).getTime() : 0;
      return tb - ta;
    });



    // ---------- Bloco C · Movimentações de caixa ----------
    const movements = (movementsRes.data ?? []) as CashMovement[];
    const manualMovements = movements.filter((m) => !isSettlementMovement(m));
    const settlementMovements = movements.filter(isSettlementMovement);

    const cashIn = manualMovements
      .filter((m) => m.type === "cash_in")
      .reduce((s, m) => s + Number(m.amount ?? 0), 0);
    const cashOut = manualMovements
      .filter((m) => m.type === "cash_out")
      .reduce((s, m) => s + Number(m.amount ?? 0), 0);
    const settlementMovementsTotal = settlementMovements.reduce(
      (s, m) => s + (m.type === "cash_in" ? 1 : -1) * Number(m.amount ?? 0),
      0,
    );

    // ---------- Dinheiro esperado · somente dinheiro físico ----------
    // Recebimentos (B) em dinheiro entram integralmente. Vendas (A) em
    // dinheiro entram apenas quando NÃO possuem liquidação dentro da janela
    // (vendas legadas, pagas sem passar pelo motor de baixa) — assim o mesmo
    // dinheiro nunca é contado duas vezes. PIX, cartão, link e gateway nunca
    // alteram a gaveta.
    const openingBalance = Number(session.opening_balance ?? 0);
    const cashSales = visibleSales
      .filter(
        (sale) =>
          isPhysicalCash(sale.payment_method) && !settledSessionSaleIds.has(sale.id),
      )
      .reduce((s, sale) => s + Number(sale.grand_total ?? 0), 0);
    const cashReceipts = Array.from(mergedReceipts.values())
      .filter((tx) => includeTest || !testTransactionIds.has(tx.id))
      .filter((tx) => isPhysicalCash(tx.payment_method))
      .reduce((s, tx) => s + Number(tx.amount ?? 0), 0);

    // Pagamentos liquidados em dinheiro dentro da janela reduzem a gaveta.
    const mergedPayments = new Map<string, { id: string; amount: number | null; payment_method: string | null; settlement_session_id?: string | null }>();
    for (const tx of (paymentsRes.data ?? []) as typeof mergedPayments extends Map<string, infer V> ? V[] : never) {
      const pinned = tx.settlement_session_id ?? null;
      if (pinned && pinned !== session.id) continue;
      mergedPayments.set(tx.id, tx);
    }
    for (const tx of (pinnedPaymentsRes.data ?? []) as typeof mergedPayments extends Map<string, infer V> ? V[] : never) {
      mergedPayments.set(tx.id, tx);
    }
    const cashPayments = Array.from(mergedPayments.values())
      .filter((tx) => isPhysicalCash(tx.payment_method))
      .reduce((s, tx) => s + Number(tx.amount ?? 0), 0);

    const expectedCash =
      openingBalance + cashSales + cashReceipts - cashPayments + cashIn - cashOut;


    return {
      openingBalance,
      cashIn,
      cashOut,
      cashSales,
      cashReceipts,
      cashPayments,
      expectedCash,
      salesCount,
      salesTotal,
      byMethod,
      receipts,
      receiptsTotal,
      receiptsByMethod,
      movements,
      manualMovements,
      settlementMovements,
      settlementMovementsTotal,
      sales,
      salesTotalProduction,
      salesTotalTest,
      salesTotalAll: salesTotalProduction + salesTotalTest,
      testSalesCount,
      testMovementIds: movements
        .filter((m) => m.transaction_id && testTransactionIds.has(m.transaction_id))
        .map((m) => m.id),
    };
  },


  async closeSession(
    input: CloseSessionInput,
  ): Promise<{ session: CashSession; summary: CashSummary }> {
    const current = await this.getSession(input.sessionId);
    if (!current) throw new Error("Sessão não encontrada.");
    if (current.status !== "open") throw new Error("Sessão já está fechada.");

    // Snapshot do resumo no momento do fechamento.
    const summary = await this.computeSummary(current);
    const difference = Number(input.countedCash) - summary.expectedCash;

    const { data, error } = await supabase
      .from("cash_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        counted_cash: input.countedCash,
        expected_cash: summary.expectedCash,
        difference,
        closing_note: input.closingNote ?? null,
        sales_count: summary.salesCount,
        sales_total: summary.salesTotal,
        cash_in_total: summary.cashIn,
        cash_out_total: summary.cashOut,
        by_method: JSON.parse(JSON.stringify(summary.byMethod)),
      })
      .eq("id", input.sessionId)
      .eq("status", "open")
      .select()
      .single();
    if (error) throw error;
    return { session: data as CashSession, summary };
  },
};
