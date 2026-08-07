import { formatCurrency, formatDate } from "@/lib/format";
import { 
  AccountingSummary,
} from "../../types";
import { 
  MonthlyClosingAudit, 
  MonthlyClosingChecklistItem, 
  MonthlyClosingHealthScore 
} from "../types";
import { AuditPurchaseRow, AuditProductRow, AuditSupplierRow } from "../../services/ports";

/**
 * Motor de Auditoria de Compras do Fechamento Mensal (Sprint 8.3E).
 * 
 * LEITURA PURA: Consome o AccountingSummary e dados de compras 
 * para gerar o checklist, score e resumo de compras.
 */
export function auditPurchasesClosing(
  summary: AccountingSummary,
  purchases: AuditPurchaseRow[],
  products: AuditProductRow[],
  suppliers: AuditSupplierRow[],
  month: string
): MonthlyClosingAudit {
  const checklist: MonthlyClosingChecklistItem[] = [];
  const timeline: any[] = [];
  
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Pedidos Pendentes e Atrasados
  const pendingPurchases = purchases.filter(p => p.status === 'pending' || p.status === 'draft');
  const delayedPurchases = pendingPurchases.filter(p => p.purchaseDate && p.purchaseDate < todayStr);

  if (pendingPurchases.length > 0) {
    checklist.push({
      id: "pur_pending",
      domain: "purchases",
      title: "Pedidos Pendentes",
      status: "warning",
      message: `${pendingPurchases.length} pedidos ainda não foram finalizados ou recebidos.`
    });
  }

  if (delayedPurchases.length > 0) {
    checklist.push({
      id: "pur_delayed",
      domain: "purchases",
      title: "Pedidos Atrasados",
      status: "error",
      message: `${delayedPurchases.length} pedidos estão com data de entrega/emissão ultrapassada.`
    });
    
    delayedPurchases.slice(0, 3).forEach(p => {
      timeline.push({
        date: p.purchaseDate || new Date().toISOString(),
        domain: "purchases",
        event: `Pedido ${p.number || p.id.slice(0,8)} está atrasado.`,
        type: "error"
      });
    });
  }

  // 2. Parcialmente Recebidos (No NexOS status 'partial' existe?)
  const partialPurchases = purchases.filter(p => p.status === 'partial');
  if (partialPurchases.length > 0) {
    checklist.push({
      id: "pur_partial",
      domain: "purchases",
      title: "Recebimento Parcial",
      status: "warning",
      message: `${partialPurchases.length} compras foram recebidas apenas parcialmente.`
    });
  }

  // 3. Compras sem Recebimento/Conferência
  const unreceivedPurchases = purchases.filter(p => p.status === 'approved' && !p.purchaseDate); 
  if (unreceivedPurchases.length > 0) {
    checklist.push({
      id: "pur_unreceived",
      domain: "purchases",
      title: "Compras sem Recebimento",
      status: "warning",
      message: `${unreceivedPurchases.length} compras aprovadas aguardam entrada física.`
    });
  }

  // 4. Fornecedores Inativos
  const inactiveSuppliersInPurchases = Array.from(new Set(
    purchases
      .filter(p => {
        const sup = suppliers.find(s => s.id === p.supplierId);
        return sup && sup.status === 'inactive';
      })
      .map(p => p.supplierName)
  ));

  if (inactiveSuppliersInPurchases.length > 0) {
    checklist.push({
      id: "pur_inactive_suppliers",
      domain: "purchases",
      title: "Fornecedores Inativos",
      status: "warning",
      message: `Compras vinculadas a fornecedores inativos: ${inactiveSuppliersInPurchases.join(', ')}.`
    });
  }

  // 5. Produtos aguardando reposição (Abaixo do mínimo)
  const belowMin = products.filter(p => p.stock < p.minStock);
  if (belowMin.length > 0) {
    checklist.push({
      id: "pur_stock_replenishment",
      domain: "purchases",
      title: "Aguardando Reposição",
      status: "warning",
      message: `${belowMin.length} produtos críticos estão abaixo do estoque mínimo.`
    });
  }

  // 6. Compras sem vínculo financeiro ou documento
  const noFinance = purchases.filter(p => !p.hasFinance && p.status === 'received');
  if (noFinance.length > 0) {
    checklist.push({
      id: "pur_no_finance",
      domain: "purchases",
      title: "Sem Vínculo Financeiro",
      status: "error",
      message: `${noFinance.length} compras recebidas não possuem lançamentos no Contas a Pagar.`
    });
  }

  // 7. Compras canceladas
  const cancelledCount = purchases.filter(p => p.status === 'cancelled').length;
  if (cancelledCount > 0) {
    timeline.push({
      date: new Date().toISOString(),
      domain: "purchases",
      event: `${cancelledCount} compras foram canceladas este mês.`,
      type: "warning"
    });
  }

  // 8. Análise de Médias (Simulação baseada em grandTotal)
  const avgPurchase = purchases.length > 0 
    ? purchases.reduce((acc, p) => acc + p.grandTotal, 0) / purchases.length 
    : 0;
  
  const highPurchases = purchases.filter(p => p.grandTotal > avgPurchase * 1.5 && p.status !== 'cancelled');
  if (highPurchases.length > 0) {
    checklist.push({
      id: "pur_high_average",
      domain: "purchases",
      title: "Compras Acima da Média",
      status: "info",
      message: `${highPurchases.length} pedidos estão 50% acima do ticket médio de compra.`
    });
  }

  // 9. Score de Compras (0-100)
  let score = 100;
  if (delayedPurchases.length > 0) score -= 30;
  if (noFinance.length > 0) score -= 25;
  if (pendingPurchases.length > 5) score -= 15;
  if (belowMin.length > 10) score -= 10;
  if (inactiveSuppliersInPurchases.length > 0) score -= 10;
  score = Math.max(0, score);

  const healthScore: MonthlyClosingHealthScore = {
    score,
    level: score >= 90 ? "Excelente" : score >= 70 ? "Boa" : score >= 40 ? "Atenção" : "Crítica",
    label: score >= 90 
      ? "Processo de compras fluido e organizado." 
      : score >= 70 
        ? "Compras sob controle, com ajustes pontuais necessários." 
        : "Setor de compras com gargalos de recebimento ou atrasos."
  };

  // Resumo Executivo
  const totalValue = purchases.filter(p => p.status === 'received').reduce((acc, p) => acc + p.grandTotal, 0);
  const topSupplier = purchases.length > 0 
    ? purchases.reduce((acc: any, p) => {
        if (!p.supplierName) return acc;
        acc[p.supplierName] = (acc[p.supplierName] || 0) + p.grandTotal;
        return acc;
      }, {})
    : {};
  
  const mainSupplierName = Object.entries(topSupplier).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "Nenhum";
  const biggestPurchase = purchases.length > 0 ? Math.max(...purchases.map(p => p.grandTotal)) : 0;

  return {
    month,
    healthScore,
    checklist,
    summary: {
      monthSummary: `Auditoria de compras de ${month}. Total recebido: ${formatCurrency(totalValue)}.`,
      achievements: score >= 90 ? ["Fluxo de recebimento em dia", "Fornecedores homologados"] : [],
      problems: checklist.filter(i => i.status === "error" || i.status === "warning").map(i => i.message || i.title),
      biggestRisk: delayedPurchases.length > 0 ? "Atrasos em pedidos podem causar ruptura de estoque imediata." : "Garantir o vínculo financeiro de todas as entradas.",
      biggestOpportunity: `Negociar melhores prazos com ${mainSupplierName}, seu principal fornecedor.`,
      finalRecommendation: score >= 70 ? "Setor de compras pronto para o fechamento." : "Regularize os pedidos atrasados e vincule o financeiro das compras recebidas."
    },
    timeline
  };
}
