/**
 * Bella Daily Brief
 *
 * Monta o resumo executivo textual da Home. Consome apenas o snapshot
 * já derivado dos eventos — não acessa serviços nem banco.
 */

import type { BellaEvent } from "../events";
import type {
  BellaDailyBrief,
  BellaMetricsSnapshot,
  BellaPriorityItem,
} from "./types";
import { resolveGreeting } from "./BellaGreeting";

export interface BuildDailyBriefInput {
  events: BellaEvent[];
  priorities: BellaPriorityItem[];
  metrics: BellaMetricsSnapshot;
  now?: Date;
}

export function buildDailyBrief(input: BuildDailyBriefInput): BellaDailyBrief {
  const { events, priorities, metrics } = input;
  const now = input.now ?? new Date();

  const greeting = `${resolveGreeting(now)}!`;

  const criticals = metrics.critical;
  const summaryLine =
    criticals > 0
      ? `Hoje existe${criticals > 1 ? "m" : ""} ${criticals} prioridade${criticals > 1 ? "s" : ""} crítica${criticals > 1 ? "s" : ""}.`
      : metrics.totalActive > 0
        ? `Hoje há ${metrics.totalActive} pontos de atenção acompanhados pela Bella.`
        : "Nenhuma prioridade crítica hoje — dia tranquilo até agora.";

  const prioritiesLine =
    priorities.length === 0
      ? "Nenhuma prioridade em destaque no momento."
      : `Prioridades em destaque: ${priorities.map((p) => p.title).slice(0, 2).join(" · ")}.`;

  const mlPending = events.filter((e) => e.type === "sale.created" && e.source === "mercadolivre").length;
  const mlLine = mlPending > 0 ? `Há ${mlPending} pedido${mlPending > 1 ? "s" : ""} do Mercado Livre pendente${mlPending > 1 ? "s" : ""} para importação.` : "";

  const overdue = events.filter((e) => e.type === "finance.invoice.overdue").length;
  const cashflow = events.some((e) => e.type === "finance.cashflow.negative");
  const dueToday = events.filter((e) => {
    if (e.type !== "finance.invoice.overdue") return false;
    const dueDate = e.payload?.dueDate;
    if (typeof dueDate !== "string") return false;
    return dueDate.split("T")[0] === now.toISOString().split("T")[0];
  }).length;

  const financeLine = overdue > 0
    ? `Você possui ${overdue} conta${overdue > 1 ? "s" : ""} vencida${overdue > 1 ? "s" : ""}${dueToday > 0 ? `, sendo ${dueToday} vencendo hoje` : ""}.`
    : cashflow
      ? "O caixa do período está negativo."
      : "Financeiro sem pendências críticas.";

  const stockCritical = events.filter(
    (e) => e.type === "inventory.min_stock_reached" || e.type === "inventory.out_of_stock",
  ).length;
  const slowMoving = events.filter((e) => e.type === "inventory.slow_moving");
  const slowCount = slowMoving.length;
  const stagnantValue = slowMoving.reduce((sum, e) => sum + (Number(e.payload?.inventoryValue) || 0), 0);

  const salesUp = events.some((e) => e.type === "sales.above_average" || e.type === "sales.goal_reached");
  const salesDown = events.some((e) => e.type === "sales.decline" || e.type === "sales.average_ticket.drop");

  let commercialLine = "Área comercial estável, sem alertas.";

  if (stockCritical > 0) {
    commercialLine = `Há ${stockCritical} produto${stockCritical > 1 ? "s" : ""} com estoque crítico.`;
  } else if (slowCount > 0) {
    commercialLine = stagnantValue > 0
      ? `Identifiquei ${slowCount} produto${slowCount > 1 ? "s" : ""} sem giro, com R$ ${stagnantValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} imobilizados.`
      : `Há ${slowCount} produto${slowCount > 1 ? "s" : ""} sem giro no estoque.`;
  } else if (salesUp) {
    commercialLine = "As vendas seguem acima da média.";
  } else if (salesDown) {
    commercialLine = "As vendas apresentam queda em relação ao padrão.";
  }

  const closingLine = criticals > 0
    ? "Minha recomendação é resolver primeiro as pendências críticas."
    : metrics.totalActive > 0
      ? "Aproveite para adiantar as pendências acompanhadas."
      : "Bom momento para planejar as próximas ações.";

  // Comercial KPIs deriváveis do registry (Eventos ativos)
  const salesGoal = events.find((e) => e.type === "sales.goal_reached");
  const salesDecline = events.find((e) => e.type === "sales.decline");
  const ticketDrop = events.find((e) => e.type === "sales.average_ticket.drop");

  // Recomendações comerciais fixas baseadas em eventos
  const recommendations: string[] = [];
  if (salesGoal) recommendations.push("Meta batida! Considere novos incentivos.");
  if (salesDecline) recommendations.push("Vendas em queda: revise preços ou faça promoções.");
  if (ticketDrop) recommendations.push("Ticket baixo: treine a equipe para cross-sell.");

  return {
    greeting,
    summaryLine: mlLine ? `${summaryLine} ${mlLine}` : summaryLine,
    prioritiesLine,
    financeLine,
    commercialLine,
    closingLine: recommendations.length > 0 ? recommendations[0] : closingLine,
  };
}
