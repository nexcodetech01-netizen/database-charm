export * from "./types";
export { marketingService } from "./services/marketing.service";
export * from "./hooks/use-marketing";
export { MarketingMetrics } from "./components/marketing-metrics";
export { CampaignFormDialog } from "./components/campaign-form-dialog";
export { CampaignTable } from "./components/campaign-table";
export { CampaignInsights } from "./components/campaign-insights";
export { SegmentationPanel } from "./components/segmentation-panel";
export { CampaignsWorkspace } from "./components/campaigns-workspace";
export { campaignAudienceService, audienceToCsv, SEGMENT_PRESET_OPTIONS } from "./services/campaign-audience.service";
export type {
  CampaignAudienceCriteria,
  CampaignAudienceCustomer,
  CampaignAudienceResult,
  CampaignAudiencePreview,
  SegmentPreset,
} from "./services/campaign-audience.service";
export { useCampaignAudience, campaignAudienceKeys } from "./hooks/use-campaign-audience";
export { SalesCenterDialog } from "./central-vendas/sales-center-dialog";
export {
  SALES_CHANNELS,
  generateSalesContent,
} from "./central-vendas/generate-sales-content";
export type {
  SalesChannel,
  SalesChannelMeta,
  GeneratedContent,
  ContentBlock,
  ProductForSales,
} from "./central-vendas/generate-sales-content";
