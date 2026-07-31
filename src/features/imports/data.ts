import type {
  ImportHistoryEntry,
  ImportSource,
  ImportStatus,
} from "./types";

/**
 * Mock/placeholder data used exclusively to render the visual scaffolding
 * of the Importações module. No real processing, uploads, or persistence
 * are wired to these values.
 */
export const IMPORT_SOURCES: ImportSource[] = [
  {
    id: "xml_nfe",
    title: "XML NF-e",
    description: "Importa notas fiscais eletrônicas para lançar entrada de produtos.",
    accept: ".xml",
    status: "coming_soon",
    lastImportAt: null,
  },
  {
    id: "excel",
    title: "Excel",
    description: "Planilhas .xlsx para cargas em massa de qualquer entidade.",
    accept: ".xlsx,.xls",
    status: "coming_soon",
    lastImportAt: null,
  },
  {
    id: "csv",
    title: "CSV",
    description: "Arquivos .csv com separador vírgula ou ponto e vírgula.",
    accept: ".csv",
    status: "coming_soon",
    lastImportAt: null,
  },
  {
    id: "supplier_catalog",
    title: "Catálogo de fornecedor",
    description: "Catálogos oficiais dos fornecedores parceiros.",
    accept: ".xlsx,.csv,.xml",
    status: "coming_soon",
    lastImportAt: null,
  },
  {
    id: "ofx",
    title: "OFX",
    description: "Extratos bancários no formato Open Financial Exchange.",
    accept: ".ofx",
    status: "coming_soon",
    lastImportAt: null,
  },
  {
    id: "cnab",
    title: "CNAB",
    description: "Retornos bancários CNAB 240/400 para conciliação financeira.",
    accept: ".ret,.txt",
    status: "coming_soon",
    lastImportAt: null,
  },
  {
    id: "products",
    title: "Produtos",
    description: "Importação padrão de produtos com SKU, preços e estoque.",
    accept: ".xlsx,.csv",
    status: "coming_soon",
    lastImportAt: null,
  },
  {
    id: "customers",
    title: "Clientes",
    description: "Carga inicial de clientes com contato, endereço e tags.",
    accept: ".xlsx,.csv",
    status: "coming_soon",
    lastImportAt: null,
  },
  {
    id: "suppliers",
    title: "Fornecedores",
    description: "Carga inicial de fornecedores com dados fiscais e contato.",
    accept: ".xlsx,.csv",
    status: "coming_soon",
    lastImportAt: null,
  },
];

export const IMPORT_HISTORY: ImportHistoryEntry[] = [];

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  queued: "Na fila",
  validating: "Validando",
  previewing: "Pré-visualização",
  importing: "Importando",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};
