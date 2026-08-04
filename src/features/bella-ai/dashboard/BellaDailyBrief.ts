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
  const financeLine = overdue > 0
    ? `Você possui ${overdue} conta${overdue > 1 ? "s" : ""} vencida${overdue > 1 ? "s" : ""}.`
    : cashflow
      ? "O caixa do período está negativo."
      : "Financeiro sem pendências críticas.";

  const stock = events.filter(
    (e) => e.type === "inventory.min_stock_reached" || e.type === "inventory.out_of_stock",
  ).length;
  const salesUp = events.some((e) => e.type === "sales.above_average" || e.type === "sales.goal_reached");
  const salesDown = events.some((e) => e.type === "sales.decline" || e.type === "sales.average_ticket.drop");
  const commercialLine = stock > 0
    ? `Há ${stock} produto${stock > 1 ? "s" : ""} com estoque crítico.`
    : salesUp
      ? "As vendas seguem acima da média."
      : salesDown
        ? "As vendas apresentam queda em relação ao padrão."
        : "Área comercial estável, sem alertas.";

  const closingLine = criticals > 0
    ? "Minha recomendação é resolver primeiro as pendências críticas."
    : metrics.totalActive > 0
      ? "Aproveite para adiantar as pendências acompanhadas."
      : "Bom momento para planejar as próximas ações.";

  return {
    greeting,
    summaryLine: mlLine ? `${summaryLine} ${mlLine}` : summaryLine,
    prioritiesLine,
    financeLine,
    commercialLine,
    closingLine,
  };
}
