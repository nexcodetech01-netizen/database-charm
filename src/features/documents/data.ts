import type {
  DocumentCategory,
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  DocumentOrigin,
  DocumentFormat,
} from "./types";

/**
 * Mock vazio — Central de Documentos é apenas arquitetura visual nesta sprint.
 */
export const DOCUMENT_RECORDS: DocumentRecord[] = [];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  order: "Pedido",
  quote: "Orçamento",
  purchase: "Compra",
  receipt: "Recibo",
  payment_receipt: "Comprovante",
  danfe: "DANFE",
  label: "Etiqueta",
  contract: "Contrato",
  report: "Relatório",
  xml: "XML",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  ready: "Pronto",
  generating: "Gerando",
  pending: "Pendente",
  shared: "Compartilhado",
  signed: "Assinado",
  archived: "Arquivado",
  failed: "Erro",
};

export const DOCUMENT_ORIGIN_LABELS: Record<DocumentOrigin, string> = {
  sales: "Vendas",
  purchases: "Compras",
  finance: "Financeiro",
  bella_pay: "Bella Pay",
  crm: "CRM",
  inventory: "Estoque",
  manual: "Manual",
};

export const DOCUMENT_FORMAT_LABELS: Record<DocumentFormat, string> = {
  pdf: "PDF",
  xml: "XML",
  csv: "CSV",
  xlsx: "Excel",
  png: "PNG",
  zip: "ZIP",
};

export const DOCUMENT_CATEGORIES: { id: DocumentCategory; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "orders", label: "Pedidos" },
  { id: "quotes", label: "Orçamentos" },
  { id: "purchases", label: "Compras" },
  { id: "receipts", label: "Recibos" },
  { id: "finance", label: "Financeiro" },
  { id: "fiscal", label: "Fiscal" },
  { id: "contracts", label: "Contratos" },
  { id: "labels", label: "Etiquetas" },
];

/**
 * Mapeia cada tipo de documento para a aba/categoria a que ele pertence.
 * Serve para o filtro visual — nenhuma regra de negócio depende disto.
 */
export const DOCUMENT_TYPE_TO_CATEGORY: Record<DocumentType, DocumentCategory> = {
  order: "orders",
  quote: "quotes",
  purchase: "purchases",
  receipt: "receipts",
  payment_receipt: "finance",
  danfe: "fiscal",
  xml: "fiscal",
  contract: "contracts",
  label: "labels",
  report: "finance",
};
