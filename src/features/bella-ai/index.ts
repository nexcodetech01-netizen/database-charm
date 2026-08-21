export * from "./types";
export * from "./providers";
// Mover a exportação de ações para baixo e comentar a exportação do engine
// export * from "./actions";
export * from "./context";
export * from "./providers/modules";
export { assistantService } from "./services/assistant.service";
export { alertsService } from "./services/alerts.service";
export { recommendationsService } from "./services/recommendations.service";
export { insightsService } from "./services/insights.service";
export { contextService } from "./services/context.service";
export * from "./hooks/use-bella";
export * from "./hooks/use-bella-dashboard";
export * from "./dashboard";
export { BellaKpiRow } from "./components/bella-kpi-row";
export { BellaExecutiveStrip } from "./components/bella-executive-strip";
export { BellaPrioritiesBlock } from "./components/bella-priorities-block";
export { BellaDailyBriefCard } from "./components/bella-daily-brief-card";
export { BellaPriorityCenterCard } from "./components/bella-priority-center-card";
export { BellaMetricsStrip } from "./components/bella-metrics-strip";
export { BellaMetrics } from "./components/bella-metrics";
export { BellaProvidersCard } from "./components/bella-providers-card";
export { BellaCenter } from "./components/bella-center";
export { BellaContextSources } from "./components/bella-context-sources";
export { BellaOverviewGrid } from "./components/bella-overview-grid";
export { BellaInsightsGrid } from "./components/bella-insights-grid";
export { BellaAutomationsList } from "./components/bella-automations-list";
export { BellaAgentsGrid } from "./components/bella-agents-grid";
export { BellaPromptsLibrary } from "./components/bella-prompts-library";
export { BellaHistoryTimeline } from "./components/bella-history-timeline";
// BellaAskPanel exportado seletivamente para ser importado dinamicamente onde necessário
// export { BellaAskPanel } from "./components/bella-ask-panel";
export { BellaGreetingHero } from "./components/bella-greeting-hero";
export type { BellaGreetingHeroProps } from "./components/bella-greeting-hero";
export { BellaQuickActions } from "./components/bella-quick-actions";
export { BellaSkillCard, formatSkillDuration } from "./components/bella-skill-card";
export type { BellaSkillCardProps, BellaSkillCardStatus } from "./components/bella-skill-card";
export { BellaEmptyState } from "./components/bella-empty-state";
export type { BellaEmptyStateProps } from "./components/bella-empty-state";
export { BellaHero } from "./components/bella-hero";
export { BellaSuggestedTasks } from "./components/bella-suggested-tasks";
export { BellaPrioritiesToday } from "./components/bella-priorities-today";
export { BellaExecutiveNarrative } from "./components/bella-executive-narrative";
export { BellaMissions } from "./components/bella-missions";
export { BellaRecentConversations } from "./components/bella-recent-conversations";
export { InsightsPanel } from "./components/insights-panel";
export { MissionPanel } from "./components/mission-panel";
export { PriorityPanel } from "./components/priority-panel";
export { ExecutiveSummary } from "./components/executive-summary";
export { ConversationHistory } from "./components/conversation-history";
export { ActionCard } from "./components/action-card";
export * from "./data";
export { BellaInlineSuggestion } from "./components/bella-inline-suggestion";
export { BellaProductCard } from "./components/bella-product-card";
export type { BellaInlineSuggestionProps, BellaInlineAction } from "./components/bella-inline-suggestion";
export {
  ProductsBellaHints,
  SalesBellaHints,
  PurchasesBellaHints,
  FinanceBellaHints,
  MarketingBellaHints,
} from "./components/bella-module-hints";
export {
  runExecutiveEngine,
  getExecutiveSummary,
  getExecutiveScore,
  getExecutiveMetrics,
  getExecutiveComparisons,
  getExecutiveRecommendations,
  invalidateExecutiveCache,
  useExecutiveSummary,
  useExecutiveScore,
  useExecutiveComparisons,
} from "./intelligence";
export type {
  ExecutiveSummary as ExecutiveSummaryData,
  ExecutiveMetrics as ExecutiveMetricsData,
  ExecutiveScore as ExecutiveScoreData,
  ExecutiveInsight,
  ExecutiveRecommendation as ExecutiveRecommendationItem,
  ExecutiveAlert as ExecutiveAlertItem,
  ComparisonResult,
  PeriodKey,
PeriodKey as PeriodKeyType
} from "./intelligence";
export { ExecutiveSummaryCard } from "./components/executive-summary-card";
export { ExecutiveScoreGauge } from "./components/executive-score-gauge";
export { ExecutiveInsightsList } from "./components/executive-insights-list";
export { ExecutiveRecommendationsList } from "./components/executive-recommendations-list";

// Exportação seletiva de ações para evitar vazamento do BellaActionEngine
export { keywordParser } from "./actions/keyword-parser";
export {
  financeHandlers,
  getCashBalanceHandler,
  getMonthRevenueHandler,
  getMonthExpensesHandler,
  getOverdueBillsHandler,
  getCashflowHandler,
  getFinancialSummaryHandler,
} from "./actions/finance-handlers";
