/**
 * Bella Contadora — automações (arquitetura, sem agendamento real).
 *
 * Nenhum job é registrado nesta sprint: apenas o catálogo tipado que as
 * próximas sprints vão ligar ao agendador existente do NexOS.
 */
export type AccountingAutomationId =
  | "daily_summary"
  | "weekly_summary"
  | "monthly_summary"
  | "monthly_closing"
  | "financial_alerts";

export type AutomationCadence = "daily" | "weekly" | "monthly" | "event";

export interface AccountingAutomationDefinition {
  id: AccountingAutomationId;
  title: string;
  description: string;
  cadence: AutomationCadence;
  /** Skills consultadas quando a automação for ativada. */
  usesSkills: string[];
  enabled: false;
  status: "planned";
}

export const accountingAutomations: AccountingAutomationDefinition[] = [
  {
    id: "daily_summary",
    title: "Resumo Diário",
    description: "Vendas, caixa e alertas do dia.",
    cadence: "daily",
    usesSkills: ["consultar_caixa", "consultar_lucro"],
    enabled: false,
    status: "planned",
  },
  {
    id: "weekly_summary",
    title: "Resumo Semanal",
    description: "Resultado da semana e produtos em destaque.",
    cadence: "weekly",
    usesSkills: ["consultar_lucro", "consultar_produtos"],
    enabled: false,
    status: "planned",
  },
  {
    id: "monthly_summary",
    title: "Resumo Mensal",
    description: "DRE, margens e impostos da competência.",
    cadence: "monthly",
    usesSkills: ["consultar_dre", "consultar_impostos"],
    enabled: false,
    status: "planned",
  },
  {
    id: "monthly_closing",
    title: "Fechamento Mensal",
    description: "Checklist de fechamento contábil da competência.",
    cadence: "monthly",
    usesSkills: ["consultar_dre", "consultar_prolabore", "consultar_reserva"],
    enabled: false,
    status: "planned",
  },
  {
    id: "financial_alerts",
    title: "Alertas Financeiros",
    description: "Liquidez, inadimplência e resultado negativo.",
    cadence: "event",
    usesSkills: ["consultar_caixa", "consultar_fluxo"],
    enabled: false,
    status: "planned",
  },
];

export function getAccountingAutomation(
  id: AccountingAutomationId,
): AccountingAutomationDefinition | undefined {
  return accountingAutomations.find((a) => a.id === id);
}
