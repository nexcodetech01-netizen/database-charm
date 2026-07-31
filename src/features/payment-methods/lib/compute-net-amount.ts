import type { PaymentMethodFee, SaleFeeBreakdown } from "../types";
import { resolveFeeMethodKey } from "./resolve-method-key";

const num = (v: unknown): number =>
  typeof v === "number" ? v : v == null ? 0 : Number(v) || 0;

export interface ComputeNetInput {
  gross: number;
  paymentMethod: string | null | undefined;
  installments?: number | null;
  fees: PaymentMethodFee[];
}

/**
 * Calcula o breakdown de taxa de recebimento a partir das configurações
 * cadastradas em Configurações → Meios de Pagamento.
 *
 * Nunca retorna valor negativo; se não houver método casado ou o método
 * estiver inativo, taxa = 0 e `net = gross` (comportamento seguro para
 * vendas antigas e métodos não mapeados).
 */
export function computeNetAmount({
  gross,
  paymentMethod,
  installments,
  fees,
}: ComputeNetInput): SaleFeeBreakdown {
  const grossN = Math.max(0, num(gross));
  const key = resolveFeeMethodKey(paymentMethod, installments);
  if (!key) {
    return {
      resolvedKey: null,
      feePercent: 0,
      feeFixed: 0,
      feeAmount: 0,
      net: grossN,
    };
  }
  const match = fees.find((f) => f.method_key === key && f.active);
  if (!match) {
    return {
      resolvedKey: key,
      feePercent: 0,
      feeFixed: 0,
      feeAmount: 0,
      net: grossN,
    };
  }
  const feePercent = num(match.fee_percent);
  const feeFixed = num(match.fee_fixed);
  const feeAmount = Math.min(grossN, grossN * (feePercent / 100) + feeFixed);
  return {
    resolvedKey: key,
    feePercent,
    feeFixed,
    feeAmount,
    net: Math.max(0, grossN - feeAmount),
  };
}

/**
 * Soma o valor líquido de várias vendas usando o mesmo mapa de taxas.
 * Usado por agregadores (Painel Executivo, Dashboard, Relatórios).
 */
export function sumNetRevenue(
  sales: Array<{
    grand_total: number | string | null;
    payment_method?: string | null;
    installments?: number | null;
  }>,
  fees: PaymentMethodFee[],
): { gross: number; fee: number; net: number } {
  let gross = 0;
  let fee = 0;
  let net = 0;
  for (const s of sales) {
    const g = num(s.grand_total);
    const b = computeNetAmount({
      gross: g,
      paymentMethod: s.payment_method ?? null,
      installments: s.installments ?? null,
      fees,
    });
    gross += g;
    fee += b.feeAmount;
    net += b.net;
  }
  return { gross, fee, net };
}
