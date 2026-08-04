/**
 * Importações — tipos base do módulo.
 *
 * Nada aqui executa. É apenas o contrato visual/estrutural que os futuros
 * importadores (XML NF-e, Excel, CSV, OFX, CNAB, Catálogos) irão implementar.
 */

export type ImportSourceId =
  | "xml_nfe"
  | "excel"
  | "csv"
  | "supplier_catalog"
  | "ofx"
  | "cnab"
  | "products"
  | "customers"
  | "suppliers"
  | "mercadolivre";

export type ImportSourceStatus = "ready" | "beta" | "coming_soon";

export interface ImportSource {
  id: ImportSourceId;
  title: string;
  description: string;
  accept: string;
  status: ImportSourceStatus;
  lastImportAt: string | null;
  lastImportCount?: number | null;
}

export type ImportStatus =
  | "queued"
  | "validating"
  | "previewing"
  | "importing"
  | "completed"
  | "failed"
  | "cancelled";

export interface ImportHistoryEntry {
  id: string;
  fileName: string;
  sourceId: ImportSourceId;
  sourceLabel: string;
  date: string;
  userName: string;
  totalRecords: number;
  status: ImportStatus;
}

export interface ImportPreviewSummary {
  created: number;
  updated: number;
  ignored: number;
  duplicated: number;
  errors: number;
}

export interface ImportExecutionLog {
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  processedRows: number;
  errors: number;
}

export type ImportWizardStep =
  | "select"
  | "validate"
  | "preview"
  | "import"
  | "result";
