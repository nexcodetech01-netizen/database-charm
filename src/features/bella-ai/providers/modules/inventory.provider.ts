import type {
  BellaAlert,
  BellaInsight,
  BellaMetric,
  BellaModuleProvider,
  BellaSuggestion,
  BellaSummary,
} from "./base";

const now = () => new Date().toISOString();

export const inventoryProvider: BellaModuleProvider = {
  module: "inventory",
  displayName: "Estoque",

  async getInsights() {
    return [
      {
        id: "inv-insight-1",
        module: "inventory",
        title: "30 SKUs sem venda nos últimos 60 dias",
        description: "Considere promoção ou reposicionamento no catálogo.",
        priority: "medium",
        createdAt: now(),
      },
    ] satisfies BellaInsight[];
  },

  async getSummary(): Promise<BellaSummary> {
    return {
      module: "inventory",
      headline: "Estoque saudável com atenção a itens críticos",
      highlights: [
        "SKUs ativos: 412",
        "Itens abaixo do mínimo: 8",
        "Itens parados 60d: 30",
      ],
      updatedAt: now(),
    };
  },

  async getAlerts(): Promise<BellaAlert[]> {
    return [
      {
        id: "inv-alert-1",
        module: "inventory",
        title: "8 produtos abaixo do estoque mínimo",
        description: "Reposição sugerida para evitar ruptura.",
        severity: "warning",
        createdAt: now(),
      },
    ];
  },

  async getMetrics(): Promise<BellaMetric[]> {
    return [
      { key: "skus_active", label: "SKUs ativos", value: "412", trend: "flat" },
      { key: "below_min", label: "Abaixo do mínimo", value: "8", trend: "down" },
      { key: "stalled", label: "Parados 60d", value: "30", trend: "flat" },
    ];
  },

  async getSuggestions(): Promise<BellaSuggestion[]> {
    return [
      {
        id: "inv-sug-1",
        module: "inventory",
        title: "Gerar pedido de compra sugerido",
        description: "Baseado no giro dos últimos 30 dias e estoque mínimo.",
        actionLabel: "Sugerir compra",
        priority: "high",
      },
    ];
  },
};
