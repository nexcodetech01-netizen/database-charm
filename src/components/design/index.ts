/**
 * Design System NexOS — componentes compostos (EPIC UI.1 · Sprint UI.1.2).
 * Somente apresentação: nenhum hook, serviço, rota ou regra de negócio.
 */
export { MetricCard } from "./metric-card";
export type { MetricCardProps, MetricCardTrend } from "./metric-card";
export { StatusBadge } from "./status-badge";
export type {
  StatusBadgeProps,
  StatusBadgeStatus,
  StatusBadgeAppearance,
} from "./status-badge";
export { PageHeader } from "./page-header";
export type { PageHeaderProps } from "./page-header";
export { SectionHeader } from "./section-header";
export type { SectionHeaderProps } from "./section-header";
export { ChartCard } from "./chart-card";
export type { ChartCardProps } from "./chart-card";
export { Panel } from "./panel";
export type { PanelProps } from "./panel";
export {
  EnterpriseDataTable,
  DataTableToolbar,
  DataTableFilters,
  DataTablePagination,
  DataTableEmpty,
  DataTableLoading,
  DataTableActions,
} from "./enterprise-data-table";
export type {
  EnterpriseDataTableProps,
  DataTableColumn,
  DataTableAlign,
  DataTablePaginationProps,
  DataTableToolbarProps,
} from "./enterprise-data-table";

/* Sprint UI.1.4 — Entity Layout System */
export { EntityHeader } from "./entity-header";
export type { EntityHeaderProps } from "./entity-header";
export { ActionToolbar } from "./action-toolbar";
export type { ActionToolbarProps, ActionToolbarAction } from "./action-toolbar";
export { FormLayout, FormGroup } from "./form-layout";
export type { FormLayoutProps, FormGroupProps, FormLayoutWidth } from "./form-layout";
export { MetricGrid } from "./metric-grid";
export type { MetricGridProps } from "./metric-grid";
export { StatStack } from "./stat-stack";
export type { StatStackProps, StatStackItem } from "./stat-stack";
export { Section } from "./section";
export type { SectionProps } from "./section";
