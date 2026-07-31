/**
 * Processamentos — contratos visuais do módulo.
 *
 * Nenhuma execução aqui. Apenas o formato de dados que futuros workers
 * (importação, exportação, integrações, IA, notificações, backup) irão
 * emitir para a Central de Processamentos.
 */

export type ProcessCategory =
  | "import"
  | "export"
  | "integration"
  | "finance"
  | "marketplace"
  | "ai"
  | "notification";

export type ProcessStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "scheduled"
  | "queued";

export type ProcessFilter = "all" | ProcessStatus;

export interface ProcessTimelineEvent {
  id: string;
  at: string;
  label: string;
  detail?: string;
  intent?: "info" | "success" | "warning" | "error";
}

export interface ProcessLogLine {
  id: string;
  at: string;
  level: "info" | "warning" | "error";
  message: string;
}

export interface ProcessRecord {
  id: string;
  name: string;
  origin: string;
  category: ProcessCategory;
  status: ProcessStatus;
  startedAt: string | null;
  finishedAt: string | null;
  /** Duração em ms. Quando `null`, ainda em execução ou agendado. */
  durationMs: number | null;
  userName: string;
  processed: number;
  total: number | null;
  summary?: string | null;
  timeline?: ProcessTimelineEvent[];
  logs?: ProcessLogLine[];
  errors?: string[];
}
