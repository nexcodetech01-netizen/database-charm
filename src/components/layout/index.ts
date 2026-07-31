/**
 * Barrel de primitivos visuais do NexOS.
 * Consumir componentes de layout SEMPRE a partir daqui:
 *
 *   import { PageLayout, KpiSection, KpiCard, SectionToolbar } from "@/components/layout";
 */
export { PageLayout, type PageLayoutProps } from "./page-layout";
export { PageHeader, type PageHeaderProps } from "./page-header";
export { BreadcrumbNav } from "./breadcrumb-nav";
export { KpiSection, type KpiSectionProps } from "./kpi-section";
export { KpiCard, type KpiCardProps } from "./kpi-card";
export { SectionToolbar } from "./section-toolbar";
export { FormSection, FormGrid, type FormSectionProps } from "./form-section";
export { DetailPanel, SummaryRow, type DetailPanelProps } from "./detail-panel";
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { ListSkeleton, CardsSkeleton } from "./list-skeleton";
export { MoneyValue, type MoneyValueProps } from "./money-value";
