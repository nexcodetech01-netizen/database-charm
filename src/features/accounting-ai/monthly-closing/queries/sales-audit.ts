import { formatCurrency } from "@/lib/format";
import { AccountingSummary } from "../../types";
import { 
  MonthlyClosingAudit, 
  MonthlyClosingChecklistItem, 
  MonthlyClosingHealthScore 
} from "../types";
import { AuditSaleRow, AuditProductRow, AuditCustomerRow } from "../../services/ports";

/**
 * Motor de Auditoria de Vendas do Fechamento Mensal (Sprint 8.3F).
 * 
 * LEITURA PURA: Consome o AccountingSummary e dados de vendas/clientes
 * para gerar o checklist, score e resumo comercial.
 */
export function auditSalesClosing(
  summary: AccountingSummary,
  sales: AuditSaleRow[],
  products: AuditProductRow[],
  customers: AuditCustomerRow[],
  month: string
): MonthlyClosingAudit {
  const checklist: MonthlyClosingChecklistItem[] = [];
  const timeline: any[] = [];
  
  // 1. Vendas Canceladas
  const cancelledSales = sales.filter(s => s.status === 'cancelled');
  if (cancelledSales.length > 0) {
    checklist.push({
      id: "sale_cancelled",
      domain: "sales",
      title: "Vendas Canceladas",
      status: "warning",
      message: `${cancelledSales.length} vendas foram canceladas este mês.`
    });
    
    cancelledSales.slice(0, 3).forEach(s => {
      timeline.push({
        date: s.saleDate || new Date().toISOString(),
        domain: "sales",
        event: `Venda ${s.number || s.id.slice(0,8)} foi cancelada.`,
        type: "warning"
      });
    });
  }

  // 2. Vendas sem Pagamento (Status Pendente/Aguardando)
  const unpaidSales = sales.filter(s => s.status === 'pending' || s.status === 'waiting_payment');
  if (unpaidSales.length > 0) {
    checklist.push({
      id: "sale_unpaid",
      domain: "sales",
      title: "Vendas sem Pagamento",
      status: "error",
      message: `${unpaidSales.length} vendas estão aguardando pagamento ou pendentes.`
    });
  }

  // 3. Vendas sem Cliente (Identificação)
  const noCustomerSales = sales.filter(s => !s.customerId);
  if (noCustomerSales.length > 0) {
    checklist.push({
      id: "sale_no_customer",
      domain: "sales",
      title: "Vendas sem Cliente",
      status: "warning",
      message: `${noCustomerSales.length} vendas foram realizadas sem identificação do cliente.`
    });
  }

  // 4. Vendas não Conciliadas (Diferença entre Venda e Financeiro)
  // No NexOS, settledAt indica a liquidação no financeiro.
  const unconciliatedSales = sales.filter(s => s.status === 'paid' && !s.settledAt);
  if (unconciliatedSales.length > 0) {
    checklist.push({
      id: "sale_unconciliated",
      domain: "sales",
      title: "Vendas não Conciliadas",
      status: "error",
      message: `${unconciliatedSales.length} vendas pagas ainda não foram conciliadas no financeiro.`
    });
  }

  // 5. Produtos vendidos sem estoque (Estoque Negativo)
  const negativeStockProducts = products.filter(p => p.stock < 0);
  if (negativeStockProducts.length > 0) {
    checklist.push({
      id: "sale_negative_stock",
      domain: "sales",
      title: "Venda sem Estoque",
      status: "error",
      message: `${negativeStockProducts.length} produtos foram vendidos além do saldo disponível.`
    });
  }

  // 6. Score de Vendas (0-100)
  let score = 100;
  if (unconciliatedSales.length > 0) score -= 25;
  if (unpaidSales.length > 0) score -= 20;
  if (negativeStockProducts.length > 0) score -= 20;
  if (cancelledSales.length > 5) score -= 15;
  if (noCustomerSales.length > 10) score -= 10;
  score = Math.max(0, score);

  const healthScore: MonthlyClosingHealthScore = {
    score,
    level: score >= 90 ? "Exelente" : score >= 70 ? "Boa" : score >= 40 ? "Atenção" : "Crítica",
    label: score >= 90 
      ? "Operação comercial saudável e conciliada." 
      : score >= 70 
        ? "Vendas estáveis, com pequenas pendências de conciliação." 
        : "Riscos detectados: falta de conciliação ou vendas sem estoque."
  };

  // 7. Resumo Comercial
  const totalRevenue = sales.filter(s => s.status === 'paid').reduce((acc, s) => acc + s.total, 0);
  const avgTicket = sales.length > 0 ? totalRevenue / sales.length : 0;
  
  const achievements = [];
  if (unconciliatedSales.length === 0) achievements.push("Conciliação 100% em dia");
  if (negativeStockProducts.length === 0) achievements.push("Controle de estoque rigoroso");

  return {
    month,
    healthScore,
    checklist,
    summary: {
      monthSummary: `Auditoria comercial de ${month}. Receita total: ${formatCurrency(totalRevenue)}. Ticket médio: ${formatCurrency(avgTicket)}.`,
      achievements,
      problems: checklist.filter(i => i.status === "error" || i.status === "warning").map(i => i.message || i.title),
      biggestRisk: unconciliatedSales.length > 0 ? "Vendas pagas sem conciliação financeira geram furos no caixa." : "Manter a margem de lucro acima do mínimo estabelecido.",
      biggestOpportunity: "Aumentar o ticket médio através de pacotes ou upsell de produtos campeões.",
      finalRecommendation: score >= 70 ? "Setor comercial pronto para o fechamento." : "Concilie as vendas pagas e verifique a origem das vendas com estoque negativo."
    },
    timeline
  };
}
