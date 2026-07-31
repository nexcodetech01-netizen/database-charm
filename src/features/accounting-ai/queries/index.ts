/**
 * Bella Contadora — consultas reais (Sprint 5.1).
 *
 * Cada consulta é uma LEITURA pura sobre o `AccountingSummary` já
 * produzido pelos providers da Sprint 5.0. Nada é recalculado,
 * estimado ou inventado: quando o provider não trouxe o dado,
 * a consulta responde `available: false`.
 */
import { formatCurrency } from "@/lib/format";
import type { AccountingSummary } from "../types";

export type AccountingQueryId =
  | "receita_hoje"
  | "receita_mes"
  | "lucro_bruto"
  | "lucro_liquido"
  | "caixa_disponivel"
  | "contas_a_pagar"
  | "contas_a_receber"
  | "estoque_atual"
  | "ticket_medio"
  | "produto_mais_vendido"
  | "produto_menos_vendido"
  | "cliente_que_mais_compra"
  | "cliente_maior_faturamento"
  | "valor_parado_em_estoque";

export interface AccountingQueryAnswer {
  id: AccountingQueryId;
  label: string;
  available: boolean;
  /** Valor numérico quando a consulta for monetária/quantitativa. */
  value: number | null;
  /** Texto determinístico, montado apenas com dados reais. */
  text: string;
  detail?: string;
}

const NO_DATA = "sem dados no período";

function answer(
  id: AccountingQueryId,
  label: string,
  value: number | null,
  text: string,
  detail?: string,
): AccountingQueryAnswer {
  return { id, label, available: value !== null, value, text, detail };
}

function missing(id: AccountingQueryId, label: string): AccountingQueryAnswer {
  return { id, label, available: false, value: null, text: `${label}: ${NO_DATA}.` };
}

export const accountingQueries = {
  receitaHoje(s: AccountingSummary): AccountingQueryAnswer {
    const d = s.today.data;
    if (!d) return missing("receita_hoje", "Receita hoje");
    return answer(
      "receita_hoje",
      "Receita hoje",
      d.total,
      `Hoje (${d.date}) sua empresa faturou ${formatCurrency(d.total)} em ${d.count} venda(s).`,
    );
  },

  receitaMes(s: AccountingSummary): AccountingQueryAnswer {
    const d = s.revenue.data;
    if (!d) return missing("receita_mes", "Receita do mês");
    return answer(
      "receita_mes",
      "Receita do mês",
      d.netRevenue,
      `Receita líquida do período: ${formatCurrency(d.netRevenue)} (bruta ${formatCurrency(d.grossRevenue)}).`,
    );
  },

  lucroBruto(s: AccountingSummary): AccountingQueryAnswer {
    const d = s.profit.data;
    if (!d) return missing("lucro_bruto", "Lucro bruto");
    return answer(
      "lucro_bruto",
      "Lucro bruto",
      d.grossProfit,
      `Lucro bruto de ${formatCurrency(d.grossProfit)} (margem ${d.grossMargin.toFixed(2)}%).`,
    );
  },

  lucroLiquido(s: AccountingSummary): AccountingQueryAnswer {
    const d = s.profit.data;
    if (!d) return missing("lucro_liquido", "Lucro líquido");
    return answer(
      "lucro_liquido",
      "Lucro líquido",
      d.netProfit,
      `Lucro líquido de ${formatCurrency(d.netProfit)} (margem ${d.netMargin.toFixed(2)}%).`,
    );
  },

  caixaDisponivel(s: AccountingSummary): AccountingQueryAnswer {
    const d = s.cash.data;
    if (!d) return missing("caixa_disponivel", "Caixa disponível");
    return answer(
      "caixa_disponivel",
      "Caixa disponível",
      d.currentBalance,
      `Saldo atual em caixa: ${formatCurrency(d.currentBalance)}.`,
    );
  },

  contasAPagar(s: AccountingSummary): AccountingQueryAnswer {
    const d = s.cash.data;
    if (!d) return missing("contas_a_pagar", "Contas a pagar");
    return answer(
      "contas_a_pagar",
      "Contas a pagar",
      d.payable,
      `Contas a pagar em aberto: ${formatCurrency(d.payable)}.`,
    );
  },

  contasAReceber(s: AccountingSummary): AccountingQueryAnswer {
    const d = s.cash.data;
    if (!d) return missing("contas_a_receber", "Contas a receber");
    return answer(
      "contas_a_receber",
      "Contas a receber",
      d.receivable,
      `Contas a receber: ${formatCurrency(d.receivable)} (vencidas ${formatCurrency(d.receivableOverdue)}).`,
    );
  },

  estoqueAtual(s: AccountingSummary): AccountingQueryAnswer {
    const d = s.inventory.data;
    if (!d) return missing("estoque_atual", "Estoque atual");
    return answer(
      "estoque_atual",
      "Estoque atual",
      d.inventoryValue,
      `Estoque avaliado em ${formatCurrency(d.inventoryValue)} — ${d.productCount} produtos, ${d.totalItems} itens.`,
    );
  },

  ticketMedio(s: AccountingSummary): AccountingQueryAnswer {
    const d = s.ticket.data;
    if (!d) return missing("ticket_medio", "Ticket médio");
    return answer(
      "ticket_medio",
      "Ticket médio",
      d.averageTicket,
      `Ticket médio de ${formatCurrency(d.averageTicket)} em ${d.salesCount} venda(s).`,
    );
  },

  produtoMaisVendido(s: AccountingSummary): AccountingQueryAnswer {
    const top = s.products.data?.bestSellers[0];
    if (!top) return missing("produto_mais_vendido", "Produto mais vendido");
    return answer(
      "produto_mais_vendido",
      "Produto mais vendido",
      top.revenue,
      `Produto campeão: ${top.name} — ${top.quantity} unidade(s), ${formatCurrency(top.revenue)}.`,
      top.sku ?? undefined,
    );
  },

  produtoMenosVendido(s: AccountingSummary): AccountingQueryAnswer {
    const worst = s.products.data?.worstSellers[0];
    if (!worst) return missing("produto_menos_vendido", "Produto menos vendido");
    return answer(
      "produto_menos_vendido",
      "Produto menos vendido",
      worst.revenue,
      `Produto com menor giro vendido: ${worst.name} — ${worst.quantity} unidade(s), ${formatCurrency(worst.revenue)}.`,
      worst.sku ?? undefined,
    );
  },

  clienteQueMaisCompra(s: AccountingSummary): AccountingQueryAnswer {
    const list = s.customers.data?.topCustomers ?? [];
    const top = [...list].sort((a, b) => b.purchases - a.purchases)[0];
    if (!top) return missing("cliente_que_mais_compra", "Cliente que mais compra");
    return answer(
      "cliente_que_mais_compra",
      "Cliente que mais compra",
      top.purchases,
      `Cliente com mais compras: ${top.name} — ${top.purchases} compra(s).`,
    );
  },

  clienteMaiorFaturamento(s: AccountingSummary): AccountingQueryAnswer {
    const list = s.customers.data?.topCustomers ?? [];
    const top = [...list].sort((a, b) => b.revenue - a.revenue)[0];
    if (!top) return missing("cliente_maior_faturamento", "Cliente com maior faturamento");
    return answer(
      "cliente_maior_faturamento",
      "Cliente com maior faturamento",
      top.revenue,
      `Maior faturamento: ${top.name} — ${formatCurrency(top.revenue)}.`,
    );
  },

  /**
   * Valor parado em estoque: o motor de estoque devolve os produtos sem giro
   * mas não o custo individual deles, então informamos apenas o que existe
   * (quantidade de produtos parados) — nada é estimado.
   */
  valorParadoEmEstoque(s: AccountingSummary): AccountingQueryAnswer {
    const inv = s.inventory.data;
    const stagnant = s.products.data?.stagnant ?? [];
    if (!inv) return missing("valor_parado_em_estoque", "Valor parado em estoque");
    const units = stagnant.reduce((acc, p) => acc + p.stock, 0);
    return answer(
      "valor_parado_em_estoque",
      "Valor parado em estoque",
      inv.stagnantCount,
      `${inv.stagnantCount} produto(s) sem giro (${units} unidade(s) paradas). Estoque total avaliado em ${formatCurrency(inv.inventoryValue)}.`,
      "O motor de estoque não fornece o custo isolado dos itens parados.",
    );
  },
} as const;

/** Todas as consultas na ordem do catálogo da Sprint 5.1. */
export function runAllAccountingQueries(s: AccountingSummary): AccountingQueryAnswer[] {
  return [
    accountingQueries.receitaHoje(s),
    accountingQueries.receitaMes(s),
    accountingQueries.lucroBruto(s),
    accountingQueries.lucroLiquido(s),
    accountingQueries.caixaDisponivel(s),
    accountingQueries.contasAPagar(s),
    accountingQueries.contasAReceber(s),
    accountingQueries.estoqueAtual(s),
    accountingQueries.ticketMedio(s),
    accountingQueries.produtoMaisVendido(s),
    accountingQueries.produtoMenosVendido(s),
    accountingQueries.clienteQueMaisCompra(s),
    accountingQueries.clienteMaiorFaturamento(s),
    accountingQueries.valorParadoEmEstoque(s),
  ];
}
