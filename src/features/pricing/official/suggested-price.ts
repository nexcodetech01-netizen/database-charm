/**
 * REGRA DE NEGÓCIO — MOTOR COMERCIAL V2
 * =====================================
 * Ponto ÚNICO de geração do preço sugerido de um produto.
 *
 * Nenhum módulo (cadastro, importação, Bella, marketplace, simulador) pode
 * formar preço por conta própria. Todos chamam `computeSuggestedPrice`, que:
 *   1. resolve a taxa REAL do Asaas (`payment_method_fees`) para a faixa de
 *      valor do produto, respeitando a política de parcelamento da empresa
 *      (até R$ 100 → 1x; acima → até 3x sem juros) usando o PIOR CASO;
 *   2. delega 100% da matemática ao motor oficial (`computeOfficialPricing`
 *      → `engine/compute.ts`).
 *
 * A taxa depende do preço e o preço depende da taxa (faixa de parcelamento).
 * A convergência é feita aqui, em um único lugar, por iteração determinística.
 *
 * PURO — sem I/O, sem clock ambiente.
 */
import {
  computeOfficialPricing,
  evaluateOfficialPrice,
  type OfficialPricing,
  type OfficialPricingInput,
} from "./official-pricing";
import { maxInstallmentsForAmount, worstCaseFee, type CompanyFeeTable } from "./fees";

export interface SuggestedPriceInput extends Omit<OfficialPricingInput, "fee"> {
  /** Tabela única de taxas da empresa (Asaas). */
  feeTable: CompanyFeeTable;
}

const MAX_ITERATIONS = 4;

/**
 * Preço sugerido oficial. Retorna o `OfficialPricing` completo (auditoria,
 * warnings, min/recomendado/premium) — nenhum consumidor recalcula nada.
 */
export function computeSuggestedPrice(input: SuggestedPriceInput): OfficialPricing {
  const { feeTable, ...pricing } = input;

  // Ponto de partida: preço formado SEM taxa (também vindo do motor — nunca
  // somamos custos aqui) apenas para descobrir a faixa de parcelamento.
  let last: OfficialPricing = computeOfficialPricing({ ...pricing, fee: { pct: 0 } });
  let reference = last.targetPrice;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const fee = worstCaseFee(feeTable, reference);
    const result = computeOfficialPricing({
      ...pricing,
      fee: {
        methodKey: fee.methodKey,
        label: fee.label,
        pct: fee.feePct,
        fixed: fee.feeFixed,
      },
    });
    last = result;
    const next = result.targetPrice;
    if (maxInstallmentsForAmount(next) === maxInstallmentsForAmount(reference)) break;
    reference = next;
  }

  return last;
}

/**
 * Resolve o preço que entrega um LUCRO LÍQUIDO alvo (R$) em um canal —
 * usado, por exemplo, para "manter o lucro da loja" ao publicar em
 * marketplace. A avaliação de cada candidato é feita pelo motor oficial
 * (`evaluateOfficialPrice`); aqui existe apenas a busca binária, nunca
 * uma fórmula de preço paralela.
 */
export function solvePriceForTargetProfit(
  input: Omit<OfficialPricingInput, "rounding">,
  targetProfit: number,
): number | null {
  if (!Number.isFinite(targetProfit)) return null;
  const evaluate = (price: number) => evaluateOfficialPrice(price, input).profit;

  let low = 0;
  let high = Math.max(1, input.costs.acquisition + Math.max(0, targetProfit)) * 2;

  for (let i = 0; i < 40 && evaluate(high) < targetProfit; i += 1) {
    low = high;
    high *= 2;
    if (high > 1e9) return null;
  }
  if (evaluate(high) < targetProfit) return null;

  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (evaluate(mid) < targetProfit) low = mid;
    else high = mid;
  }
  const price = Math.round(high * 100) / 100;
  return price > 0 ? price : null;
}
