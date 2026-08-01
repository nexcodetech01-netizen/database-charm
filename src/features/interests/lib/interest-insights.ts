/**
 * Lista de Interesse — camada PURA (Sprint Comercial 8.1).
 *
 * Somente leitura e agregação determinística. Nenhuma venda, reserva,
 * movimentação de estoque, orçamento ou envio de mensagem acontece aqui.
 */
import {
  OPEN_INTEREST_STATUSES,
  type InterestStatus,
  type ProductInterestRow,
} from "../types";

export function isOpenInterest(status: InterestStatus): boolean {
  return OPEN_INTEREST_STATUSES.includes(status);
}

export interface InterestProductAggregate {
  productId: string;
  productName: string;
  waiting: number;
  stock: number;
  unitPrice: number;
  /** Potencial = 1 unidade por interesse em aberto × preço do produto. */
  potential: number;
  /** Produto já disponível (estoque > 0) com clientes ainda aguardando. */
  available: boolean;
}

export interface InterestSummary {
  /** Interesses em aberto. */
  openCount: number;
  /** Clientes distintos aguardando (nome + telefone quando sem cadastro). */
  waitingCustomers: number;
  /** Produtos distintos aguardados. */
  waitedProducts: number;
  /** Potencial de venda somado. */
  potential: number;
  /** Interesses em aberto cujo produto já tem estoque. */
  readyCount: number;
  byProduct: InterestProductAggregate[];
}

function customerKey(row: ProductInterestRow): string {
  return row.customer_id ?? `${row.customer_name.trim().toLowerCase()}|${row.phone ?? ""}`;
}

/** Agrega interesses em aberto por produto (determinístico e ordenado). */
export function summarizeInterests(rows: ProductInterestRow[]): InterestSummary {
  const open = rows.filter((r) => isOpenInterest(r.status));
  const map = new Map<string, InterestProductAggregate>();

  for (const row of open) {
    const stock = Number(row.product?.stock ?? 0) || 0;
    const price = Number(row.product?.price ?? 0) || 0;
    const current = map.get(row.product_id) ?? {
      productId: row.product_id,
      productName: row.product?.name ?? "Produto",
      waiting: 0,
      stock,
      unitPrice: price,
      potential: 0,
      available: stock > 0,
    };
    current.waiting += 1;
    current.potential = current.waiting * current.unitPrice;
    map.set(row.product_id, current);
  }

  const byProduct = [...map.values()].sort(
    (a, b) => b.waiting - a.waiting || a.productName.localeCompare(b.productName, "pt-BR"),
  );

  return {
    openCount: open.length,
    waitingCustomers: new Set(open.map(customerKey)).size,
    waitedProducts: byProduct.length,
    potential: byProduct.reduce((sum, p) => sum + p.potential, 0),
    readyCount: open.filter((r) => Number(r.product?.stock ?? 0) > 0).length,
    byProduct,
  };
}

/** Quantidade de clientes aguardando por produto (interesses em aberto). */
export function waitingCountByProduct(rows: ProductInterestRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (!isOpenInterest(row.status)) continue;
    out[row.product_id] = (out[row.product_id] ?? 0) + 1;
  }
  return out;
}

export interface InterestInsight {
  id: string;
  text: string;
  tone: "info" | "success" | "warning";
}

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Insights determinísticos da Bella — READ ONLY.
 * A Bella apenas informa; nenhuma mensagem é enviada a clientes.
 */
export function buildInterestInsights(summary: InterestSummary): InterestInsight[] {
  const insights: InterestInsight[] = [];
  if (summary.openCount === 0) return insights;

  if (summary.readyCount > 0) {
    insights.push({
      id: "interest-ready",
      tone: "success",
      text:
        summary.readyCount === 1
          ? "Há 1 cliente aguardando um produto que já está disponível."
          : `Há ${summary.readyCount} clientes aguardando produtos que já estão disponíveis.`,
    });
  }

  const top = summary.byProduct[0];
  if (top) {
    insights.push({
      id: "interest-top",
      tone: "info",
      text: `O produto mais aguardado é ${top.productName} (${top.waiting} ${
        top.waiting === 1 ? "cliente" : "clientes"
      }).`,
    });
  }

  if (summary.potential > 0) {
    insights.push({
      id: "interest-potential",
      tone: "info",
      text: `A soma do potencial de vendas é ${BRL(summary.potential)}.`,
    });
  }

  return insights;
}

/**
 * Aviso exibido quando um produto volta ao estoque.
 * Retorna `null` quando não há ninguém aguardando ou o estoque segue zerado.
 */
export function stockBackInterestNotice(args: {
  stock: number;
  waiting: number;
}): string | null {
  if (args.waiting <= 0) return null;
  if (Number(args.stock) <= 0) return null;
  return "Existem clientes aguardando este produto.";
}
