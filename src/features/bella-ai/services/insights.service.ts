import { recommendationsService } from "./recommendations.service";
import { alertsService } from "./alerts.service";
import type { RecommendationCategory } from "../types";

/**
 * Insights Service — leitura estruturada de insights por área
 * (financeiro, vendas, clientes, produtos, marketing, agenda).
 *
 * Sprint 14: apenas o esqueleto. A geração é composta por
 * recommendations + alerts filtrados por categoria/módulo.
 */

const INSIGHT_CATEGORIES: RecommendationCategory[] = [
  "finance",
  "sales",
  "customers",
  "products",
  "marketing",
  "agenda",
];

export interface InsightBucket {
  category: RecommendationCategory;
  recommendations: number;
  alerts: number;
}

export const insightsService = {
  categories: INSIGHT_CATEGORIES,

  async byCategory(companyId: string): Promise<InsightBucket[]> {
    const [recs, alerts] = await Promise.all([
      recommendationsService.list(companyId),
      alertsService.list(companyId),
    ]);

    return INSIGHT_CATEGORIES.map((category) => {
      const recCount = recs.filter((r) => r.category === category).length;
      const alertCount = alerts.filter(
        (a) => (a.metadata as { category?: string } | null)?.category === category,
      ).length;
      return { category, recommendations: recCount, alerts: alertCount };
    });
  },

  async totalAvailable(companyId: string): Promise<number> {
    const [recs, alerts] = await Promise.all([
      recommendationsService.list(companyId),
      alertsService.list(companyId),
    ]);
    return recs.length + alerts.length;
  },
};
