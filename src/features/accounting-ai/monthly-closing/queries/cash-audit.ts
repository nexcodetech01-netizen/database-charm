import { formatCurrency } from "@/lib/format";
import { AccountingSummary } from "../../types";
import { 
  MonthlyClosingAudit, 
  MonthlyClosingChecklistItem, 
  MonthlyClosingHealthScore 
} from "../types";
import { AuditCashSessionRow } from "../../services/ports";

/**
 * Motor de Auditoria de Caixa do Fechamento Mensal (Sprint 8.3G).
 * 
 * LEITURA PURA: Consome dados das sessões de caixa e o sumário contábil
 * para gerar o checklist, score e resumo de caixa.
 */
export function auditCashClosing(
  summary: AccountingSummary,
  sessions: AuditCashSessionRow[],
  month: string
): MonthlyClosingAudit {
  const checklist: MonthlyClosingChecklistItem[] = [];
  const timeline: any[] = [];
  
  // 1. Caixas Abertos (Impede fechamento mensal)
  const openSessions = sessions.filter(s => s.status === "open");
  if (openSessions.length > 0) {
    checklist.push({
      id: "cash_open",
      domain: "pos",
      title: "Caixas Abertos",
      status: "error",
      message: `Existem ${openSessions.length} sessões de caixa ainda abertas.`
    });
    
    openSessions.slice(0, 3).forEach(s => {
      timeline.push({
        date: s.openedAt || new Date().toISOString(),
        domain: "pos",
        event: `Caixa ${s.id.slice(0, 8)}... aberto em ${s.openedAt ? new Date(s.openedAt).toLocaleDateString() : 'data desconhecida'}.`,
        type: "warning"
      });
    });
  }

  // 2. Diferenças de Caixa (Quebras)
  const sessionsWithDiff = sessions.filter(s => s.difference !== null && Math.abs(s.difference) > 0.01);
  const totalDiff = sessionsWithDiff.reduce((acc, s) => acc + (s.difference || 0), 0);
  
  if (sessionsWithDiff.length > 0) {
    checklist.push({
      id: "cash_diff",
      domain: "pos",
      title: "Diferenças de Caixa",
      status: Math.abs(totalDiff) > 50 ? "error" : "warning",
      message: `Identificadas ${sessionsWithDiff.length} sessões com quebra de caixa. Total acumulado: ${formatCurrency(totalDiff)}.`
    });

    sessionsWithDiff.slice(0, 3).forEach(s => {
      timeline.push({
        date: s.closedAt || new Date().toISOString(),
        domain: "pos",
        event: `Quebra de ${formatCurrency(s.difference || 0)} no fechamento da sessão ${s.id.slice(0, 8)}...`,
        type: Math.abs(s.difference || 0) > 20 ? "error" : "warning"
      });
    });
  }

  // 3. Score de Caixa (0-100)
  let score = 100;
  if (openSessions.length > 0) score -= 40;
  if (Math.abs(totalDiff) > 100) score -= 30;
  else if (Math.abs(totalDiff) > 0) score -= 15;
  if (sessions.length === 0) score = 50; // Sem dados no período
  score = Math.max(0, score);

  const totalExpected = sessions.reduce((acc, s) => acc + (s.expectedCash || 0), 0);

  const healthScore: MonthlyClosingHealthScore = {
    score,
    level: score >= 90 ? "Excelente" : score >= 70 ? "Boa" : score >= 40 ? "Atenção" : "Crítica",
    label: score >= 90 
      ? "Operação de caixa conciliada e organizada." 
      : score >= 70 
        ? "Caixa sob controle, com pequenas divergências." 
        : "Riscos operacionais: caixas abertos ou quebras significativas."
  };

  // Resumo Executivo
  const achievements = [];
  if (openSessions.length === 0 && sessions.length > 0) achievements.push("Todas as sessões encerradas");
  if (Math.abs(totalDiff) < 1) achievements.push("Zero quebras de caixa relevantes");

  return {
    month,
    healthScore,
    checklist,
    summary: {
      monthSummary: `Auditoria de frente de caixa de ${month}. Total processado: ${formatCurrency(totalExpected)}.`,
      achievements,
      problems: checklist.filter(i => i.status === "error" || i.status === "warning").map(i => i.message || i.title),
      biggestRisk: openSessions.length > 0 ? "Caixas abertos impedem a apuração real do faturamento diário." : "Diferenças recorrentes indicam falha no processo de conferência.",
      biggestOpportunity: "Digitalizar mais recebimentos para reduzir o manuseio de papel moeda e quebras.",
      finalRecommendation: score >= 70 ? "Fluxo de caixa PDV pronto para o fechamento." : "Encerre todos os caixas e justifique as quebras superiores a R$ 20,00."
    },
    timeline: timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  };
}
