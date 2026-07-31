import type {
  BellaAlert,
  BellaInsight,
  BellaMetric,
  BellaModuleProvider,
  BellaProviderContext,
  BellaSuggestion,
  BellaSummary,
} from "./base";

const now = () => new Date().toISOString();

export const salesProvider: BellaModuleProvider = {
  module: "sales",
  displayName: "Vendas",

  async getInsights(_ctx: BellaProviderContext): Promise<BellaInsight[]> {
    return [
      {
        id: "sales-insight-1",
        module: "sales",
        title: "Ticket médio subiu 12% esta semana",
        description: "Vendas com mais de 2 itens cresceram na última semana.",
        priority: "medium",
        createdAt: now(),
      },
    ];
  },

  async getSummary(_ctx): Promise<BellaSummary> {
    return {
      module: "sales",
      headline: "Vendas estáveis nos últimos 7 dias",
      highlights: [
        "Ticket médio: R$ 248,00",
        "Conversão do PDV: 63%",
        "Categoria líder: Acessórios",
      ],
      updatedAt: now(),
    };
  },

  async getAlerts(_ctx): Promise<BellaAlert[]> {
    return [];
  },

  async getMetrics(_ctx): Promise<BellaMetric[]> {
    return [
      { key: "revenue_7d", label: "Receita 7d", value: "R$ 18.420", trend: "up" },
      { key: "avg_ticket", label: "Ticket médio", value: "R$ 248,00", trend: "up" },
      { key: "conversion", label: "Conversão PDV", value: "63%", trend: "flat" },
    ];
  },

  async getSuggestions(_ctx): Promise<BellaSuggestion[]> {
    return [
      {
        id: "sales-sug-1",
        module: "sales",
        title: "Criar campanha para clientes recorrentes",
        description: "12 clientes compraram 3x nos últimos 60 dias.",
        actionLabel: "Criar campanha",
        priority: "medium",
      },
    ];
  },
};
