import type {
  BellaAlert,
  BellaInsight,
  BellaMetric,
  BellaModuleProvider,
  BellaSuggestion,
  BellaSummary,
} from "./base";

const now = () => new Date().toISOString();

export const customerProvider: BellaModuleProvider = {
  module: "customer",
  displayName: "Clientes",

  async getInsights() {
    return [
      {
        id: "cus-insight-1",
        module: "customer",
        title: "24 clientes inativos há mais de 90 dias",
        description: "Oportunidade de reativação com campanha segmentada.",
        priority: "medium",
        createdAt: now(),
      },
    ] satisfies BellaInsight[];
  },

  async getSummary(): Promise<BellaSummary> {
    return {
      module: "customer",
      headline: "Base de clientes em crescimento",
      highlights: [
        "Clientes ativos: 186",
        "Novos no mês: 14",
        "Inativos 90d: 24",
      ],
      updatedAt: now(),
    };
  },

  async getAlerts(): Promise<BellaAlert[]> {
    return [];
  },

  async getMetrics(): Promise<BellaMetric[]> {
    return [
      { key: "active", label: "Ativos", value: "186", trend: "up" },
      { key: "new_month", label: "Novos no mês", value: "14", trend: "up" },
      { key: "inactive_90d", label: "Inativos 90d", value: "24", trend: "flat" },
    ];
  },

  async getSuggestions(): Promise<BellaSuggestion[]> {
    return [
      {
        id: "cus-sug-1",
        module: "customer",
        title: "Campanha de reativação",
        description: "Enviar mensagem personalizada para clientes 90d+ inativos.",
        actionLabel: "Preparar campanha",
        priority: "medium",
      },
    ];
  },
};
