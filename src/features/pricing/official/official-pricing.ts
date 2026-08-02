/**
 * MOTOR COMERCIAL OFICIAL — camada de consumo (FASE 1, 2, 3)
 * ==========================================================
 * ÚNICA porta de entrada para qualquer cálculo de preço no NexOS.
 * Não calcula nada por conta própria: monta o `PricingContext` e delega
 * 100% para `pricing/engine/compute.ts` (motor canônico, ADR-001).
 *
 * Proibido em qualquer outro arquivo do sistema:
 *   - somar componentes de custo
 *   - dividir custo por (1 - margem)
 *   - aplicar taxa de canal / imposto manualmente
 *   - arredondar preço comercial
 */
import { compute } from "../engine/compute";
import { explain } from "../engine/explain";
import {
  COST_COMPOSITION_VERSION,
  CHANNEL_CONTRACT_VERSION,
  CONTEXT_VERSION,
  TAX_QUOTE_VERSION,
  type CommercialBehaviorSpec,
  type PricingContext,
  type PricingExplanation,
  type PricingResult,
  type RoundingPolicySpec,
} from "../engine/types";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const cents = (v: unknown): number => Math.round(num(v) * 100);
const brl = (c: number): number => Math.round(c) / 100;

/** Componentes de custo unificados (FASE 3). Todos em R$ por unidade. */
export interface OfficialCostInput {
  /** Custo pago ao fornecedor. */
  acquisition: number;
  /** Frete de entrada rateado. */
  freight?: number;
  /** Embalagem. */
  packaging?: number;
  /** Etiqueta / rotulagem. */
  label?: number;
  /** Seguro rateado. */
  insurance?: number;
  /** Comissão fixa por unidade (vendedor/representante). */
  commission?: number;
  /** Outros custos diretos. */
  otherCosts?: number;
  /** Rateio de despesas operacionais por unidade. */
  operationalExpenses?: number;
  /** Perdas/quebras esperadas (% sobre o custo direto). */
  lossPct?: number;
}

/** Margens da política resolvida (empresa → categoria → produto). */
export interface OfficialMarginInput {
  minPct: number;
  targetPct: number;
  premiumPct?: number;
  /** FASE 5 — teto de margem por categoria (apenas alerta, nunca corta preço). */
  maxPct?: number;
}

/** Taxa aplicada na formação (vinda SEMPRE da tabela única — `fees.ts`). */
export interface OfficialFeeInput {
  methodKey?: string | null;
  label?: string;
  /** % sobre o preço. */
  pct: number;
  /** Valor fixo em R$ por venda. */
  fixed?: number;
  /** Custo financeiro adicional (% sobre o preço) — antecipação etc. */
  financialCostPct?: number;
}

export interface OfficialPricingInput {
  companyId: string;
  productId: string;
  sku?: string;
  categoryId?: string;
  categoryName?: string;
  costs: OfficialCostInput;
  margins: OfficialMarginInput;
  fee?: OfficialFeeInput;
  /** Alíquota efetiva de impostos sobre a venda (%). */
  taxPct?: number;
  /** Imposto fixo por venda (R$). */
  taxFixed?: number;
  rounding?: RoundingPolicySpec;
  behavior?: CommercialBehaviorSpec;
  quantity?: number;
  /** Piso absoluto de preço (R$). */
  priceFloor?: number;
  /** ISO — injetado (motor é puro). */
  now?: string;
  requestId?: string;
  module?: string;
}

/** Linha auditável da composição (FASE 6). */
export interface PriceAuditLine {
  key: string;
  label: string;
  source: string;
  /** Valor em R$ que entra no custo (ou é retido do preço). */
  amount: number;
  /** Percentual, quando o componente é percentual. */
  pct?: number;
  kind: "cost" | "deduction" | "result";
}

export interface OfficialPricing {
  /** Resultado bruto do motor canônico (centavos). */
  readonly result: PricingResult;
  readonly explanation: PricingExplanation;

  // ─ Espelhos em R$ para a borda (UI/relatórios) ─
  /** Custo total unitário (todos os componentes da FASE 3). */
  costTotal: number;
  /** Preço no piso da margem mínima. */
  minPrice: number;
  /** Preço na margem alvo/ideal. */
  recommendedPrice: number;
  /** Preço na margem premium. */
  premiumPrice: number;
  /** Preço final sugerido (pós comportamento, arredondamento e piso). */
  targetPrice: number;
  /** Lucro líquido em R$ (já descontadas taxas e impostos). */
  profit: number;
  /** Margem líquida sobre o preço final (%). */
  marginPct: number;
  /** Markup sobre o custo total (%). */
  markupPct: number;
  /** Taxa efetiva (%) usada na formação. */
  feePct: number;
  /** Alíquota de imposto (%) usada na formação. */
  taxPct: number;
  /** Composição auditável (FASE 6). */
  audit: PriceAuditLine[];
  /** Avisos do motor (margem abaixo do mínimo etc.). */
  warnings: PricingResult["warnings"];
}

function buildContext(input: OfficialPricingInput): {
  ctx: PricingContext;
  derived: { directCost: number; loss: number; feePct: number; taxPct: number; fixedFee: number };
} {
  const c = input.costs;
  const acquisition = Math.max(0, num(c.acquisition));
  const freight = Math.max(0, num(c.freight));
  const packaging = Math.max(0, num(c.packaging));
  const insurance = Math.max(0, num(c.insurance));
  const extras =
    Math.max(0, num(c.label)) +
    Math.max(0, num(c.commission)) +
    Math.max(0, num(c.otherCosts)) +
    Math.max(0, num(c.operationalExpenses));

  const directCost = acquisition + freight + packaging + insurance + extras;
  const lossPct = Math.max(0, num(c.lossPct));
  const loss = (directCost * lossPct) / 100;

  const feePct =
    Math.max(0, num(input.fee?.pct)) + Math.max(0, num(input.fee?.financialCostPct));
  const fixedFee = Math.max(0, num(input.fee?.fixed));
  const taxPct = Math.max(0, num(input.taxPct));

  const quantity = Math.max(1, Math.trunc(num(input.quantity) || 1));
  const now = input.now ?? new Date(0).toISOString();

  const ctx: PricingContext = {
    contextVersion: CONTEXT_VERSION,
    company: {
      id: input.companyId,
      currency: "BRL",
      defaults: {
        minMarginPct: Math.max(0, num(input.margins.minPct)),
        idealMarginPct: Math.max(0, num(input.margins.targetPct)),
        premiumMarginPct: Math.max(
          0,
          num(input.margins.premiumPct ?? input.margins.targetPct),
        ),
      },
    },
    ...(input.categoryId
      ? { category: { id: input.categoryId, name: input.categoryName } }
      : {}),
    product: {
      id: input.productId,
      ...(input.sku ? { sku: input.sku } : {}),
      ...(input.priceFloor ? { priceFloorCents: cents(input.priceFloor) } : {}),
    },
    channel: {
      channelId: input.fee?.methodKey ?? "default",
      variableFeePct: feePct,
      fixedFeePerOrderCents: cents(fixedFee),
      operationalCostCents: 0,
      version: CHANNEL_CONTRACT_VERSION,
    },
    quantity,
    currency: "BRL",
    clock: { now },
    ...(taxPct > 0 || num(input.taxFixed) > 0
      ? {
          taxQuote: {
            version: TAX_QUOTE_VERSION,
            quoteId: `company:${input.companyId}`,
            totalPctOnPrice: taxPct,
            totalFixedCents: cents(input.taxFixed),
            taxEngineVersion: "company-effective-rate/1",
          },
        }
      : {}),
    costComposition: {
      version: COST_COMPOSITION_VERSION,
      perUnitCostCents: cents(directCost + loss),
      acquisitionCostCents: cents(acquisition),
      freightCents: cents(freight),
      packagingCents: cents(packaging),
      insuranceCents: cents(insurance),
      otherExpensesCents: cents(extras + loss),
      computedAt: now,
      origin: "inventory",
    },
    marginTarget: { kind: "ideal" },
    ...(input.behavior ? { commercialBehavior: input.behavior } : {}),
    roundingPolicy: input.rounding ?? { kind: "none" },
    requestId: input.requestId ?? `pricing_${input.productId}`,
    requestedBy: { module: input.module ?? "nexos" },
  };

  return { ctx, derived: { directCost, loss, feePct, taxPct, fixedFee } };
}

function buildAudit(
  input: OfficialPricingInput,
  result: PricingResult,
  derived: { loss: number; feePct: number; taxPct: number; fixedFee: number },
): PriceAuditLine[] {
  const c = input.costs;
  const price = brl(result.finalPriceCents);
  const lines: PriceAuditLine[] = [
    { key: "acquisition", label: "Custo do fornecedor", source: "Cadastro do produto", amount: Math.max(0, num(c.acquisition)), kind: "cost" },
    { key: "freight", label: "Frete de entrada", source: "Rateio da compra", amount: Math.max(0, num(c.freight)), kind: "cost" },
    { key: "packaging", label: "Embalagem", source: "Cadastro do produto", amount: Math.max(0, num(c.packaging)), kind: "cost" },
    { key: "label", label: "Etiqueta", source: "Cadastro do produto", amount: Math.max(0, num(c.label)), kind: "cost" },
    { key: "insurance", label: "Seguro", source: "Rateio da compra", amount: Math.max(0, num(c.insurance)), kind: "cost" },
    { key: "commission", label: "Comissão", source: "Política comercial", amount: Math.max(0, num(c.commission)), kind: "cost" },
    { key: "other_costs", label: "Outros custos", source: "Cadastro do produto", amount: Math.max(0, num(c.otherCosts)), kind: "cost" },
    { key: "operational", label: "Despesas operacionais", source: "Rateio da política da empresa", amount: Math.max(0, num(c.operationalExpenses)), kind: "cost" },
  ];
  if (derived.loss > 0) {
    lines.push({
      key: "loss",
      label: "Perdas previstas",
      source: "Política comercial",
      amount: derived.loss,
      pct: Math.max(0, num(c.lossPct)),
      kind: "cost",
    });
  }
  lines.push({
    key: "fee",
    label: `Taxa ${input.fee?.label ?? "de recebimento"}`,
    source: "payment_method_fees (Asaas)",
    amount: (price * derived.feePct) / 100 + derived.fixedFee,
    pct: derived.feePct,
    kind: "deduction",
  });
  lines.push({
    key: "tax",
    label: "Impostos sobre a venda",
    source: "Perfil tributário da empresa",
    amount: (price * derived.taxPct) / 100,
    pct: derived.taxPct,
    kind: "deduction",
  });
  lines.push({
    key: "profit",
    label: "Lucro líquido",
    source: "Motor oficial de precificação",
    amount: brl(result.netProfitCents),
    pct: result.marginPct,
    kind: "result",
  });
  lines.push({
    key: "final_price",
    label: "Preço final",
    source: `explainId ${result.explainId}`,
    amount: price,
    kind: "result",
  });
  return lines;
}

/** FASE 1 — ÚNICO ponto de formação de preço do sistema. */
export function computeOfficialPricing(input: OfficialPricingInput): OfficialPricing {
  const { ctx, derived } = buildContext(input);
  const result = compute(ctx);
  const explanation = explain(result);
  return {
    result,
    explanation,
    costTotal: brl(result.costTotalCents),
    minPrice: brl(result.minPriceCents),
    recommendedPrice: brl(result.recommendedPriceCents),
    premiumPrice: brl(result.premiumPriceCents),
    targetPrice: brl(result.finalPriceCents),
    profit: brl(result.netProfitCents),
    marginPct: result.marginPct,
    markupPct: result.markupPct,
    feePct: derived.feePct,
    taxPct: derived.taxPct,
    audit: buildAudit(input, result, derived),
    warnings: result.warnings,
  };
}

export interface OfficialEvaluation {
  /** Custo total unitário. */
  costTotal: number;
  /** Lucro líquido em R$ no preço praticado. */
  profit: number;
  /** Margem líquida (%) no preço praticado. */
  marginPct: number;
  /** Markup (%) no preço praticado. */
  markupPct: number;
  feePct: number;
  taxPct: number;
  audit: PriceAuditLine[];
}

/**
 * Avalia um preço JÁ PRATICADO usando exatamente a mesma matemática do motor
 * (price list de 1 entrada = modo tabelado, sem arredondar).
 */
export function evaluateOfficialPrice(
  price: number,
  input: OfficialPricingInput,
): OfficialEvaluation {
  const { ctx, derived } = buildContext({ ...input, rounding: { kind: "none" } });
  const result = compute({
    ...ctx,
    priceList: {
      version: "price-list/1",
      priceListId: "practiced",
      productId: input.productId,
      priceCents: cents(price),
      currency: "BRL",
      fallback: "derived",
    },
  });
  return {
    costTotal: brl(result.costTotalCents),
    profit: brl(result.netProfitCents),
    marginPct: result.marginPct,
    markupPct: result.markupPct,
    feePct: derived.feePct,
    taxPct: derived.taxPct,
    audit: buildAudit(input, result, derived),
  };
}
