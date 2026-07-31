import type {
  BellaAlert,
  BellaInsight,
  BellaMetric,
  BellaModuleProvider,
  BellaSuggestion,
  BellaSummary,
} from "./base";

const now = () => new Date().toISOString();

export const marketingProvider: BellaModuleProvider = {
  module: "marketing",
  displayName: "Marketing",

  async getInsights() {
    return [
      {
        id: "mkt-insight-1",
        module: "marketing",
        title: "Catálogo público teve pico de acessos ontem",
        description: "Considere ativar campanha de WhatsApp para converter visitantes.",
        priority: "medium",
        createdAt: now(),
      },
    ] satisfies BellaInsight[];
  },

  async getSummary(): Promise<BellaSummary> {
    return {
      module: "marketing",
      headline: "Engajamento em alta no catálogo",
      highlights: [
        "Visitas 7d: 1.240",
        "CTR WhatsApp: 8,2%",
        "Coleções ativas: 6",
      ],
      updatedAt: now(),
    };
  },

  async getAlerts(): Promise<BellaAlert[]> {
    return [];
  },

  async getMetrics(): Promise<BellaMetric[]> {
    return [
      { key: "visits_7d", label: "Visitas 7d", value: "1.240", trend: "up" },
      { key: "ctr_wa", label: "CTR WhatsApp", value: "8,2%", trend: "up" },
      { key: "collections", label: "Coleções ativas", value: "6", trend: "flat" },
    ];
  },

  async getSuggestions(): Promise<BellaSuggestion[]> {
    return [
      {
        id: "mkt-sug-1",
        module: "marketing",
        title: "Publicar coleção destaque no WhatsApp",
        description: "Base engajada com aumento de acessos nas últimas 48h.",
        actionLabel: "Publicar",
        priority: "medium",
      },
    ];
  },
};
