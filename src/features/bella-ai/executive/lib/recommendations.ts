/**
 * Motor de recomendações executivas.
 *
 * Traduz insights e risco em ações objetivas. Não executa nada e não
 * recalcula regras — apenas recomenda.
 */

import type {
  ExecutiveRecommendation,
  ExecutiveRiskReport,
  ExecutiveSnapshot,
} from "../types";
import { pctChange, safeDiv } from "./normalize";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function buildExecutiveRecommendations(
  s: ExecutiveSnapshot,
  risk: ExecutiveRiskReport,
): ExecutiveRecommendation[] {
  const out: ExecutiveRecommendation[] = [];
  const { dre, cash, inventory, tax, previousDre } = s;
  const cashRisk = risk.risks.find((r) => r.key === "caixa");
  const dailyExpenses = safeDiv(dre.operatingExpenses + dre.cogs, 30);
  const cashDays = dailyExpenses > 0 ? safeDiv(cash.available, dailyExpenses) : 90;
  const turnover = safeDiv(dre.cogs, inventory.value);

  const add = (r: ExecutiveRecommendation) => out.push(r);

  if (cash.overdueReceivable > 0) {
    add({
      id: "rec_collect",
      action: "cobrar_clientes",
      title: "Cobrar clientes inadimplentes",
      description: `Existem ${BRL.format(cash.overdueReceivable)} em recebíveis vencidos. Priorize a régua de cobrança.`,
      priority: cash.overdueReceivable > cash.available ? "urgent" : "high",
    });
  }

  if (tax.estimatedTax > 0) {
    add({
      id: "rec_tax_reserve",
      action: "reservar_impostos",
      title: "Reservar caixa para tributos",
      description: `Separe ${BRL.format(tax.estimatedTax)} para os tributos da competência.`,
      priority: tax.estimatedTax > cash.available ? "urgent" : "medium",
    });
  }

  if (cashDays < 15) {
    add({
      id: "rec_cash_reserve",
      action: "reservar_caixa",
      title: "Reforçar reserva de caixa",
      description: `O caixa cobre ${cashDays.toFixed(0)} dias de operação. Reforce a reserva antes de novos compromissos.`,
      priority: "urgent",
    });
    add({
      id: "rec_avoid_purchases",
      action: "evitar_compras",
      title: "Evitar novas compras agora",
      description: "Com a cobertura de caixa curta, adie compras não essenciais até normalizar o fluxo.",
      priority: "high",
    });
  }

  if (dre.operatingExpenses > previousDre.operatingExpenses && pctChange(dre.operatingExpenses, previousDre.operatingExpenses) >= 10) {
    add({
      id: "rec_cut_expenses",
      action: "reduzir_despesas",
      title: "Reduzir despesas operacionais",
      description: `As despesas subiram para ${BRL.format(dre.operatingExpenses)}. Revise contratos e gastos recorrentes.`,
      priority: "high",
    });
  }

  const negative = s.rankings.products.filter((p) => p.revenue > 0 && p.profit < 0);
  if (negative.length > 0) {
    add({
      id: "rec_raise_price",
      action: "aumentar_preco",
      title: "Corrigir preços de produtos no prejuízo",
      description: `${negative.length} produto(s) venderam abaixo do custo. Reveja preço ou custo de ${negative.slice(0, 3).map((p) => p.name).join(", ")}.`,
      priority: "urgent",
    });
  }

  if (inventory.staleItems > 0) {
    add({
      id: "rec_promo",
      action: "fazer_promocao",
      title: "Promover estoque parado",
      description: `${inventory.staleItems} produto(s) sem giro há 90 dias. Uma promoção libera capital imobilizado.`,
      priority: inventory.staleItems >= 20 ? "high" : "medium",
    });
    add({
      id: "rec_reduce_price",
      action: "reduzir_preco",
      title: "Reduzir preço dos itens encalhados",
      description: "Ajuste pontual de preço nos itens sem giro para acelerar a saída, respeitando a margem mínima.",
      priority: "medium",
    });
  }

  const canBuy = cashDays >= 30 && turnover >= 1 && (cashRisk?.score ?? 0) >= 70;
  if (canBuy) {
    add({
      id: "rec_buy_stock",
      action: "comprar_estoque",
      title: "Repor estoque dos campeões de giro",
      description: "Caixa saudável e giro consistente: é seguro repor os produtos de maior saída.",
      priority: "medium",
    });
  } else {
    add({
      id: "rec_dont_buy",
      action: "nao_comprar",
      title: "Segurar compras neste momento",
      description: "Cobertura de caixa ou giro insuficientes para novas compras sem risco.",
      priority: "medium",
    });
  }

  return out;
}
