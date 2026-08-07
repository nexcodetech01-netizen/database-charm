import { formatCurrency } from "@/lib/format";
import { 
  AccountingSummary,
} from "../../types";
import { 
  MonthlyClosingAudit, 
  MonthlyClosingChecklistItem, 
  MonthlyClosingHealthScore 
} from "../types";
import { AuditProductRow } from "../../services/ports";

/**
 * Motor de Auditoria de Estoque do Fechamento Mensal (Sprint 8.3D).
 * 
 * LEITURA PURA: Consome o AccountingSummary, produtos e dados do Ledger 
 * para gerar o checklist, score e resumo de estoque.
 */
export function auditInventoryClosing(
  summary: AccountingSummary,
  products: AuditProductRow[],
  ledger: any[],
  month: string
): MonthlyClosingAudit {
  const checklist: MonthlyClosingChecklistItem[] = [];
  const timeline: any[] = [];
  const inventory = summary.inventory.data;
  
  // 1. Estoque Negativo
  const negativeStockProducts = products.filter(p => p.stock < 0);
  if (negativeStockProducts.length > 0) {
    checklist.push({
      id: "inv_negative",
      domain: "inventory",
      title: "Estoque Negativo",
      status: "error",
      message: `Atenção: ${negativeStockProducts.length} produtos apresentam saldo negativo.`
    });
    
    negativeStockProducts.slice(0, 3).forEach(p => {
      timeline.push({
        date: new Date().toISOString(),
        domain: "inventory",
        event: `Produto ${p.name} (${p.sku || 'S/SKU'}) está com estoque negativo: ${p.stock}.`,
        type: "error"
      });
    });
  }

  // 2. Ruptura (Abaixo do mínimo)
  const lowStock = inventory?.belowMinCount ?? products.filter(p => p.stock < p.minStock).length;
  if (lowStock > 0) {
    checklist.push({
      id: "inv_low_stock",
      domain: "inventory",
      title: "Ruptura de Estoque",
      status: "warning",
      message: `${lowStock} produtos estão abaixo do nível de segurança.`
    });
  }

  // 3. Cadastro: Sem Custo ou Sem Preço
  const missingCost = products.filter(p => !p.cost || p.cost <= 0);
  const missingPrice = products.filter(p => !p.price || p.price <= 0);
  
  if (missingCost.length > 0) {
    checklist.push({
      id: "inv_missing_cost",
      domain: "inventory",
      title: "Produtos sem Custo",
      status: "error",
      message: `${missingCost.length} produtos não possuem custo definido, afetando o cálculo de lucro.`
    });
  }

  if (missingPrice.length > 0) {
    checklist.push({
      id: "inv_missing_price",
      domain: "inventory",
      title: "Produtos sem Preço",
      status: "warning",
      message: `${missingPrice.length} produtos estão sem preço de venda.`
    });
  }

  // 4. Divergências no Ledger (Razão)
  const differences = ledger.filter(r => r.difference !== 0);
  if (differences.length > 0) {
    checklist.push({
      id: "inv_ledger_diff",
      domain: "inventory",
      title: "Divergência de Razão",
      status: "error",
      message: `${differences.length} itens possuem divergência entre o saldo atual e a movimentação histórica.`
    });
  }

  // 5. Capital Parado (Estagnados)
  const stagnantCount = inventory?.stagnantCount ?? 0;
  if (stagnantCount > 0) {
    checklist.push({
      id: "inv_stagnant",
      domain: "inventory",
      title: "Capital Parado",
      status: "warning",
      message: `${stagnantCount} produtos não tiveram movimentação recente.`
    });
  }

  // 6. Score de Estoque (0-100)
  let score = 100;
  if (negativeStockProducts.length > 0) score -= 30;
  if (differences.length > 0) score -= 20;
  if (missingCost.length > 0) score -= 20;
  if (lowStock > 0) score -= 15;
  if (stagnantCount > 0) score -= 10;
  score = Math.max(0, score);

  const healthScore: MonthlyClosingHealthScore = {
    score,
    level: score >= 90 ? "Exelente" : score >= 70 ? "Boa" : score >= 40 ? "Atenção" : "Crítica",
    label: score >= 90 
      ? "Gestão de estoque exemplar." 
      : score >= 70 
        ? "Estoque organizado, com poucas pendências." 
        : "Riscos operacionais detectados: estoque negativo ou divergente."
  };

  // Resumo Executivo
  const inventoryValue = inventory?.inventoryValue ?? 0;
  const achievements = [];
  if (negativeStockProducts.length === 0) achievements.push("Zero itens negativos");
  if (differences.length === 0) achievements.push("Razão de estoque conciliado");

  return {
    month,
    healthScore,
    checklist,
    summary: {
      monthSummary: `Auditoria de estoque de ${month}. Valor total em estoque: ${formatCurrency(inventoryValue)}.`,
      achievements,
      problems: checklist.filter(i => i.status === "error" || i.status === "warning").map(i => i.message || i.title),
      biggestRisk: negativeStockProducts.length > 0 ? "Estoque negativo impede faturamento e distorce o CMV." : "Garantir a reposição de itens em ruptura.",
      biggestOpportunity: stagnantCount > 0 ? `Liquidar ${stagnantCount} itens parados para liberar ${formatCurrency(inventoryValue * 0.1)} em caixa.` : "Otimizar o giro de estoque.",
      finalRecommendation: score >= 70 ? "Estoque pronto para o fechamento." : "Regularize saldos negativos e concilie as divergências de razão."
    },
    timeline
  };
}
