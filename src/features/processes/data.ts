import type {
  ProcessCategory,
  ProcessFilter,
  ProcessRecord,
  ProcessStatus,
} from "./types";

/**
 * Mock/placeholder vazio. A Central de Processamentos é apenas visual nesta
 * sprint — nenhum worker real está conectado ainda.
 */
export const PROCESS_RECORDS: ProcessRecord[] = [];

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  running: "Executando",
  completed: "Concluído",
  failed: "Erro",
  cancelled: "Cancelado",
  scheduled: "Agendado",
  queued: "Fila",
};

export const PROCESS_CATEGORY_LABELS: Record<ProcessCategory, string> = {
  import: "Importação",
  export: "Exportação",
  integration: "Integração",
  finance: "Financeiro",
  marketplace: "Marketplace",
  ai: "IA",
  notification: "Notificação",
};

export const PROCESS_FILTERS: { id: ProcessFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "running", label: "Executando" },
  { id: "completed", label: "Concluído" },
  { id: "failed", label: "Erro" },
  { id: "cancelled", label: "Cancelado" },
  { id: "scheduled", label: "Agendado" },
];
