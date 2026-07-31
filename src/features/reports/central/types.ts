import type { LucideIcon } from "lucide-react";
import type { DateRange } from "../types";

export type ReportCategoryId =
  | "comercial"
  | "financeiro"
  | "estoque"
  | "produtos"
  | "catalogos"
  | "clientes"
  | "compras"
  | "caixa"
  | "bella_pay"
  | "crediario";

export interface ReportColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode;
  /** Value used for export/sort/search. Falls back to row[key]. */
  value?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  className?: string;
}

export interface ReportKpi {
  label: string;
  value: string;
  hint?: string;
}

export interface ReportResult<T = Record<string, unknown>> {
  kpis?: ReportKpi[];
  summary?: string;
  columns: ReportColumn<T>[];
  rows: T[];
  emptyLabel?: string;
}

export interface ReportContext {
  companyId: string;
  range: DateRange;
}

export interface ReportDefinition {
  id: string;
  category: ReportCategoryId;
  title: string;
  description: string;
  icon: LucideIcon;
  filename: string;
  load: (ctx: ReportContext) => Promise<ReportResult>;
}

export interface ReportCategory {
  id: ReportCategoryId;
  label: string;
  icon: LucideIcon;
  description: string;
}
