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
   * Apura o resumo da sessão em TRÊS blocos independentes (ETAPA 3),
   * mas agora utilizando a VIEW CENTRALIZADA como Single Source of Truth.
   */
  async computeSummary(
    session: CashSession,
    options?: { includeTest?: boolean },
  ): Promise<CashSummary> {
    const { data: viewData, error: viewError } = await supabase
      .from("view_cash_session_summary")
      .select("*")
      .eq("session_id", session.id)
      .single();

    if (viewError) throw viewError;

    // Embora a View dê o total consolidado, ainda carregamos os detalhes 
    // para exibição no histórico/extrato das abas de conferência.
    const [salesRes, movementsRes, receiptsRes] = await Promise.all([
      supabase
        .from("sales")
        .select("id,number,payment_method,grand_total,paid_at,status,cash_session_id,is_test")
        .eq("cash_session_id", session.id)
        .in("status", ["paid", "partially_paid"]),
      supabase
        .from("cash_movements")
        .select("*")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("financial_transactions")
        .select("id,description,amount,payment_method,paid_at,source,reference_id,settlement_session_id")
        .eq("status", "paid")
        .eq("type", "income")
        .or(`settlement_session_id.eq.${session.id},and(paid_at.gte.${session.opened_at},paid_at.lte.${session.closed_at || new Date().toISOString()})`)
    ]);


    if (salesRes.error) throw salesRes.error;
    if (movementsRes.error) throw movementsRes.error;
    if (receiptsRes.error) throw receiptsRes.error;

    // Normalização para o objeto CashSummary (mantendo compatibilidade com a UI)
    const byMethod = emptyByMethod();
    const receiptsByMethod = emptyByMethod();
    const includeTest = options?.includeTest ?? false;

    const visibleSales = (salesRes.data ?? []).filter(
      (row) => includeTest || !(row as any).is_test
    );

    for (const sale of visibleSales) {
      const key = normalizeMethod(sale.payment_method);
      const amount = Number(sale.grand_total ?? 0);
      byMethod[key].count += 1;
      byMethod[key].total += amount;
    }

    const receipts = (receiptsRes.data ?? []).map(tx => {
      const key = normalizeMethod(tx.payment_method);
      const amount = Number(tx.amount ?? 0);
      receiptsByMethod[key].count += 1;
      receiptsByMethod[key].total += amount;
      return {
        id: tx.id,
        description: tx.description,
        amount,
        payment_method: tx.payment_method,
        paid_at: tx.paid_at,
        source: tx.source,
        is_test: false,
      };
    });

    const manualMovements = (movementsRes.data ?? []).filter(m => !isSettlementMovement(m));
    const settlementMovements = (movementsRes.data ?? []).filter(isSettlementMovement);

    return {
      openingBalance: Number(viewData.opening_balance ?? 0),
      cashIn: Number(viewData.cash_in ?? 0),
      cashOut: Number(viewData.cash_out ?? 0),
      cashSales: Number(viewData.cash_sales ?? 0),
      cashReceipts: Number(viewData.cash_sales ?? 0), // Na view mapeamos cash_received para cash_sales
      cashPayments: 0, // Placeholder se não houver DRE integrado na view ainda
      expectedCash: Number(viewData.expected_cash ?? 0),
      salesCount: Number(viewData.sales_count ?? 0),
      salesTotal: Number(viewData.sales_total ?? 0),
      byMethod,
      receipts,
      receiptsTotal: receipts.reduce((s, r) => s + r.amount, 0),
      receiptsByMethod,
      movements: movementsRes.data ?? [],
      manualMovements,
      settlementMovements,
      settlementMovementsTotal: settlementMovements.reduce(
        (s, m) => s + (m.type === "cash_in" ? 1 : -1) * Number(m.amount ?? 0),
        0
      ),
      sales: visibleSales.map(s => ({
        id: s.id,
        number: s.number,
        paid_at: s.paid_at,
        payment_method: s.payment_method,
        grand_total: Number(s.grand_total ?? 0),
        is_test: Boolean(s.is_test),
      })),
      salesTotalProduction: Number(viewData.sales_total ?? 0),
      salesTotalTest: 0,
      salesTotalAll: Number(viewData.sales_total ?? 0),
      testSalesCount: 0,
      testMovementIds: [],
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
