/**
 * useProductFinancials
 * ====================
 * Fonte única da verdade para as grandezas financeiras exibidas na tela
 * de detalhes do produto. Consome as colunas cruas do registro e devolve
 * todos os derivados normalizados (custo total, lucro bruto/líquido,
 * margem real, markup, valor em estoque, etc.).
 *
 * Camada 100% de apresentação — não faz I/O, não altera dados, não
 * substitui o motor puro (`@/features/pricing/calculator`) usado por
 * server functions. Existe apenas para eliminar cálculos duplicados
 * espalhados pelos componentes visuais.
 */
import { useMemo } from "react";
import { evaluateOfficialPrice } from "@/features/pricing/official";
import type { Product } from "@/features/products/types";

export type ProductFinancialsInput = Pick<
  Product,
  | "cost"
  | "freight"
  | "insurance"
  | "other_costs"
  | "price"
  | "margin"
  | "stock"
  | "min_stock"
> &
  Partial<Pick<Product, "packaging">>;

/** Linha discriminada da composição de custo — usada nos detalhamentos da UI. */
export interface CostComponentLine {
  key: "cost" | "packaging" | "freight" | "insurance" | "other_costs" | "tax";
  /** Rótulo exibido ao usuário. */
  label: string;
  /** Origem/rastro do valor, para tooltip — nada de taxa oculta. */
  source: string;
  /** Valor em R$ que entra no Custo Total. */
  amount: number;
  /** Percentual, quando o componente é percentual (impostos). */
  pct?: number;
}

export interface ProductFinancials {
  /** Componentes de custo (R$). */
  cost: number;
  packaging: number;
  freight: number;
  insurance: number;
  otherCosts: number;
  /** Alíquota de impostos aplicada na visualização (%) e seu valor em R$. */
  taxRatePct: number;
  taxAmount: number;
  /** Soma normalizada de todos os componentes de custo (R$). */
  costTotal: number;
  /** Custo sem impostos (aquisição + embalagem + frete + seguro + outros). */
  costTotalWithoutTax: number;
  /** Detalhamento discriminado de cada componente do Custo Total. */
  components: CostComponentLine[];
  /** Preço de venda praticado (R$). */
  price: number;
  /** Preço − custo total, sem descontar taxa de canal. */
  grossProfit: number;
  /** (preço × (1 − fee)) − custo total, quando `feePct` é informado. */
  netProfit: number;
  /** Margem real recalculada a partir de preço e custo (líquida de fee). */
  marginPctReal: number;
  /** Margem persistida na coluna `products.margin`. */
  marginPctStored: number;
  /** marginPctReal − marginPctStored (útil para badges de divergência). */
  marginDrift: number;
  /** Markup sobre custo total (bruto). */
  markupPct: number;
  /** Estoque atual e mínimo (unidades). */
  stock: number;
  minStock: number;
  /** Valor imobilizado = estoque × custo total. */
  stockValue: number;
  /** Espelhos em centavos para consumo por componentes cents-based. */
  costCents: number;
  costTotalCents: number;
  priceCents: number;
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function useProductFinancials(
  product: ProductFinancialsInput | null | undefined,
  opts?: { feePct?: number; taxRatePct?: number },
): ProductFinancials | null {
  const feePct = opts?.feePct;
  const taxRatePctOpt = opts?.taxRatePct;
  return useMemo(() => {
    if (!product) return null;
    const cost = num(product.cost);
    const packaging = num((product as { packaging?: number }).packaging);
    const freight = num(product.freight);
    const insurance = num(product.insurance);
    const otherCosts = num(product.other_costs);
    const price = num(product.price);

    const taxRatePct = Math.max(0, num(taxRatePctOpt));
    const taxAmount = round2((price * taxRatePct) / 100);

    const costTotalWithoutTax = round2(
      cost + packaging + freight + insurance + otherCosts,
    );
    const costTotal = round2(costTotalWithoutTax + taxAmount);

    const components: CostComponentLine[] = [
      {
        key: "cost",
        label: "Custo de aquisição",
        source: "Preço pago ao fornecedor (cadastro do produto)",
        amount: cost,
      },
      {
        key: "packaging",
        label: "Embalagem",
        source: "Custos de embalagem informados no cadastro do produto",
        amount: packaging,
      },
      {
        key: "freight",
        label: "Frete de entrada",
        source: "Frete rateado na entrada/compra deste produto",
        amount: freight,
      },
      {
        key: "insurance",
        label: "Seguro",
        source: "Seguro rateado na entrada/compra deste produto",
        amount: insurance,
      },
      {
        key: "other_costs",
        label: "Outras taxas operacionais",
        source:
          "Campo “Outros custos” do cadastro do produto (taxas operacionais adicionais)",
        amount: otherCosts,
      },
      {
        key: "tax",
        label: "Impostos sobre a venda",
        source:
          "Alíquota aplicada sobre o preço de venda apenas nesta simulação — não é persistida no produto",
        amount: taxAmount,
        pct: taxRatePct,
      },
    ];

    const marginStored = num(product.margin);
    // MOTOR ÚNICO (FASE 1/2): lucro, margem e markup vêm do motor oficial.
    const evaluation = evaluateOfficialPrice(price, {
      companyId: "",
      productId: "product-financials",
      costs: {
        acquisition: cost,
        packaging,
        freight,
        insurance,
        otherCosts,
      },
      margins: { minPct: 0, targetPct: 0 },
      fee: { pct: Math.max(0, num(feePct)) },
      taxPct: taxRatePct,
      module: "products.financials",
    });
    const grossProfit = round2(price - costTotal);
    const netProfit = round2(evaluation.profit);
    const marginPctReal = round2(evaluation.marginPct);
    const markupPct = round2(evaluation.markupPct);
    const stock = num(product.stock);
    const minStock = num(product.min_stock);


    return {
      cost,
      packaging,
      freight,
      insurance,
      otherCosts,
      taxRatePct,
      taxAmount,
      costTotal,
      costTotalWithoutTax,
      components,
      price,
      grossProfit,
      netProfit,
      marginPctReal,
      marginPctStored: marginStored,
      marginDrift: round2(marginPctReal - marginStored),
      markupPct,
      stock,
      minStock,
      stockValue: round2(stock * costTotal),
      costCents: Math.round(cost * 100),
      costTotalCents: Math.round(costTotal * 100),
      priceCents: Math.round(price * 100),
    };
  }, [product, feePct, taxRatePctOpt]);
}
