/**
 * Central de Documentos — contratos visuais.
 *
 * Toda geração de arquivos do NexOS (pedidos, orçamentos, recibos, DANFEs,
 * contratos, etiquetas, relatórios, XMLs) passará por este módulo. Nada é
 * gerado nesta sprint — apenas o formato de dados que futuros geradores
 * vão emitir para a Central.
 */

export type DocumentType =
  | "order"
  | "quote"
  | "purchase"
  | "receipt"
  | "payment_receipt"
  | "danfe"
  | "label"
  | "contract"
  | "report"
  | "xml";

export type DocumentCategory =
  | "all"
  | "orders"
  | "quotes"
  | "purchases"
  | "receipts"
  | "finance"
  | "fiscal"
  | "contracts"
  | "labels";

export type DocumentStatus =
  | "ready"
  | "generating"
  | "pending"
  | "shared"
  | "signed"
  | "archived"
  | "failed";

export type DocumentFormat = "pdf" | "xml" | "csv" | "xlsx" | "png" | "zip";

export type DocumentOrigin =
  | "sales"
  | "purchases"
  | "finance"
  | "bella_pay"
  | "crm"
  | "inventory"
  | "manual";

export interface DocumentShare {
  id: string;
  channel: "whatsapp" | "email" | "link";
  target: string;
  at: string;
}

export interface DocumentHistoryEvent {
  id: string;
  at: string;
  label: string;
  detail?: string;
  intent?: "info" | "success" | "warning" | "error";
}

export interface DocumentRecord {
  id: string;
  name: string;
  type: DocumentType;
  origin: DocumentOrigin;
  format: DocumentFormat;
  status: DocumentStatus;
  customerName: string | null;
  createdAt: string;
  /** Tamanho em bytes. `null` quando ainda não gerado. */
  sizeBytes: number | null;
  createdByName: string;
  summary?: string | null;
  downloads?: number;
  shares?: DocumentShare[];
  history?: DocumentHistoryEvent[];
}
