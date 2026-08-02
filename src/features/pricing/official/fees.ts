/**
 * Tabela ÚNICA de taxas (FASE 4)
 * ==============================
 * Fonte de verdade: `payment_method_fees` da empresa (Asaas).
 * Nenhum módulo pode usar percentual hardcoded — todos resolvem aqui.
 *
 * Regra comercial do NexOS:
 *   - Até R$ 100,00  → somente 1x
 *   - Acima de R$ 100,00 → até 3x sem juros
 * As taxas de 1x, 2x e 3x entram OBRIGATORIAMENTE na formação do preço:
 *   a formação usa o pior caso permitido (maior taxa efetiva entre as
 *   parcelas habilitadas), para que nenhuma venda parcelada fique abaixo
 *   da margem mínima.
 */

/** Linha normalizada de taxa (espelha `payment_method_fees`). */
export interface FeeRate {
  methodKey: string;
  label: string;
  installments: number | null;
  feePct: number;
  feeFixed: number;
  active: boolean;
}

export interface CompanyFeeTable {
  readonly rates: readonly FeeRate[];
}

/** Valor mínimo (R$) para liberar parcelamento. */
export const INSTALLMENT_MIN_AMOUNT = 100;
/** Teto de parcelas sem juros. */
export const MAX_INSTALLMENTS_NO_INTEREST = 3;

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Normaliza registros crus do banco para a tabela única. */
export function buildFeeTable(
  rows: ReadonlyArray<{
    method_key: string;
    label?: string | null;
    installments?: number | null;
    fee_percent?: number | string | null;
    fee_fixed?: number | string | null;
    active?: boolean | null;
  }>,
): CompanyFeeTable {
  return {
    rates: rows.map((r) => ({
      methodKey: r.method_key,
      label: r.label ?? r.method_key,
      installments: r.installments ?? null,
      feePct: num(r.fee_percent),
      feeFixed: num(r.fee_fixed),
      active: r.active !== false,
    })),
  };
}

export const EMPTY_FEE_TABLE: CompanyFeeTable = { rates: [] };

/** Número máximo de parcelas permitido para um valor de venda. */
export function maxInstallmentsForAmount(amount: number): number {
  return num(amount) > INSTALLMENT_MIN_AMOUNT ? MAX_INSTALLMENTS_NO_INTEREST : 1;
}

/** Opções de parcelamento válidas para um valor (1..N). */
export function allowedInstallments(amount: number): number[] {
  const max = maxInstallmentsForAmount(amount);
  return Array.from({ length: max }, (_, i) => i + 1);
}

export interface ResolvedFee {
  methodKey: string | null;
  label: string;
  feePct: number;
  feeFixed: number;
}

export const NO_FEE: ResolvedFee = {
  methodKey: null,
  label: "Sem taxa",
  feePct: 0,
  feeFixed: 0,
};

/** Resolve a taxa de uma method_key específica na tabela da empresa. */
export function resolveFee(table: CompanyFeeTable, methodKey: string | null): ResolvedFee {
  if (!methodKey) return NO_FEE;
  const hit = table.rates.find((r) => r.methodKey === methodKey && r.active);
  if (!hit) return { ...NO_FEE, methodKey };
  return {
    methodKey: hit.methodKey,
    label: hit.label,
    feePct: hit.feePct,
    feeFixed: hit.feeFixed,
  };
}

/** Taxa efetiva (%) de uma linha para um ticket — inclui a parte fixa. */
export function effectiveFeePct(fee: ResolvedFee, amount: number): number {
  const a = num(amount);
  if (a <= 0) return fee.feePct;
  return fee.feePct + (fee.feeFixed / a) * 100;
}

/**
 * Pior caso de cartão de crédito dentro das parcelas permitidas para o ticket.
 * É esta taxa que entra na formação do preço (FASE 4).
 */
export function worstCaseCreditFee(table: CompanyFeeTable, amount: number): ResolvedFee {
  const options = allowedInstallments(amount).map((n) => resolveFee(table, `credit_card_${n}`));
  let worst = NO_FEE;
  let worstPct = -1;
  for (const opt of options) {
    const pct = effectiveFeePct(opt, amount);
    if (pct > worstPct) {
      worstPct = pct;
      worst = opt;
    }
  }
  return worst;
}

/**
 * Taxa usada na FORMAÇÃO do preço quando o operador não escolheu meio de
 * pagamento: o pior caso entre todos os meios ativos permitidos. Garante que
 * nenhum meio de pagamento derrube a margem abaixo da mínima.
 */
export function worstCaseFee(table: CompanyFeeTable, amount: number): ResolvedFee {
  const maxInst = maxInstallmentsForAmount(amount);
  const candidates = table.rates.filter((r) => {
    if (!r.active) return false;
    if (r.methodKey.startsWith("credit_card_")) {
      const n = Number(r.methodKey.replace("credit_card_", ""));
      return Number.isFinite(n) && n <= maxInst;
    }
    return true;
  });
  let worst = NO_FEE;
  let worstPct = -1;
  for (const r of candidates) {
    const fee: ResolvedFee = {
      methodKey: r.methodKey,
      label: r.label,
      feePct: r.feePct,
      feeFixed: r.feeFixed,
    };
    const pct = effectiveFeePct(fee, amount);
    if (pct > worstPct) {
      worstPct = pct;
      worst = fee;
    }
  }
  return worst;
}

/** Snapshot das taxas de crédito 1x/2x/3x — usado em auditoria e UI. */
export function creditFeeLadder(table: CompanyFeeTable): ResolvedFee[] {
  return [1, 2, 3].map((n) => resolveFee(table, `credit_card_${n}`));
}
