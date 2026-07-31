/**
 * Bella Contadora — arquitetura de relatórios.
 *
 * Nesta sprint são apenas *definições*: id, título, seções e a fonte de
 * dados (provider já existente). A renderização/export chega nas próximas.
 */
import type { AccountingDataSource } from "../types";

export type AccountingReportId =
  | "dre"
  | "cash_flow"
  | "monthly_result"
  | "profitability"
  | "payroll"
  | "profit_distribution";

export interface AccountingReportSection {
  key: string;
  label: string;
  /** Provider/serviço de origem — nunca uma consulta nova. */
  source: AccountingDataSource;
}

export interface AccountingReportDefinition {
  id: AccountingReportId;
  title: string;
  description: string;
  sections: AccountingReportSection[];
  status: "planned";
}

export const accountingReports: AccountingReportDefinition[] = [
  {
    id: "dre",
    title: "DRE",
    description: "Demonstrativo de resultado do exercício por competência.",
    status: "planned",
    sections: [
      { key: "revenue", label: "Receitas", source: "accounting" },
      { key: "cogs", label: "Custos", source: "accounting" },
      { key: "expenses", label: "Despesas", source: "accounting" },
      { key: "result", label: "Resultado", source: "accounting" },
    ],
  },
  {
    id: "cash_flow",
    title: "Fluxo de Caixa",
    description: "Entradas, saídas e projeção de 30 dias.",
    status: "planned",
    sections: [
      { key: "balance", label: "Saldo", source: "finance" },
      { key: "forecast", label: "Projeção", source: "finance" },
    ],
  },
  {
    id: "monthly_result",
    title: "Resultado Mensal",
    description: "Evolução mês a mês de receita, lucro e EBITDA.",
    status: "planned",
    sections: [{ key: "evolution", label: "Evolução", source: "accounting" }],
  },
  {
    id: "profitability",
    title: "Rentabilidade",
    description: "Margens, ticket médio e ponto de equilíbrio.",
    status: "planned",
    sections: [
      { key: "margins", label: "Margens", source: "accounting" },
      { key: "ticket", label: "Ticket médio", source: "sales" },
    ],
  },
  {
    id: "payroll",
    title: "Pró-labore",
    description: "Sugestão de retirada sobre o lucro apurado.",
    status: "planned",
    sections: [{ key: "suggestion", label: "Sugestão", source: "accounting" }],
  },
  {
    id: "profit_distribution",
    title: "Distribuição de Lucros",
    description: "Lucro distribuível após pró-labore e reserva.",
    status: "planned",
    sections: [{ key: "distribution", label: "Distribuição", source: "accounting" }],
  },
];

export function getAccountingReport(
  id: AccountingReportId,
): AccountingReportDefinition | undefined {
  return accountingReports.find((r) => r.id === id);
}
