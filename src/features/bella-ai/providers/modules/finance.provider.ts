import type {
  BellaAlert,
  BellaInsight,
  BellaMetric,
  BellaModuleProvider,
  BellaSuggestion,
  BellaSummary,
} from "./base";

const now = () => new Date().toISOString();

export const financeProvider: BellaModuleProvider = {
  module: "finance",
  displayName: "Financeiro",

  async getInsights() {
    return [
      {
        id: "fin-insight-1",
        module: "finance",
        title: "Fluxo de caixa positivo previsto para os próximos 15 dias",
        description: "Receitas superam despesas em R$ 6.200 no período.",
        priority: "medium",
        createdAt: now(),
      },
    ] satisfies BellaInsight[];
  },

  async getSummary(): Promise<BellaSummary> {
    return {
      module: "finance",
      headline: "Saúde financeira estável",
      highlights: [
        "Contas a receber: R$ 12.480",
        "Contas a pagar: R$ 6.290",
        "Saldo projetado 15d: +R$ 6.200",
      ],
      updatedAt: now(),
    };
  },

  async getAlerts(): Promise<BellaAlert[]> {
    return [
      {
        id: "fin-alert-1",
        module: "finance",
        title: "3 títulos vencem em 48h",
        description: "Total de R$ 1.850 em contas a pagar próximas ao vencimento.",
        severity: "warning",
        createdAt: now(),
      },
    ];
  },

  async getMetrics(): Promise<BellaMetric[]> {
    return [
      { key: "receivables", label: "A receber", value: "R$ 12.480", trend: "up" },
      { key: "payables", label: "A pagar", value: "R$ 6.290", trend: "flat" },
      { key: "cash_15d", label: "Projeção 15d", value: "+R$ 6.200", trend: "up" },
    ];
  },

  async getSuggestions(): Promise<BellaSuggestion[]> {
    return [
      {
        id: "fin-sug-1",
        module: "finance",
        title: "Antecipar recebíveis de cartão",
        description: "Custo de antecipação inferior à taxa média de oportunidade.",
        actionLabel: "Simular antecipação",
        priority: "low",
      },
    ];
  },
};
