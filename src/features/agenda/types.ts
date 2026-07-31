import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Appointment = Tables<"appointments">;
export type AppointmentInsert = TablesInsert<"appointments">;
export type AppointmentUpdate = TablesUpdate<"appointments">;
export type AppointmentEvent = Tables<"appointment_events">;

export type AppointmentType =
  | "atendimento"
  | "entrega"
  | "visita"
  | "reuniao"
  | "ligacao"
  | "outro";

export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "em_andamento"
  | "concluido"
  | "cancelado";

export const APPOINTMENT_TYPE_OPTIONS: { value: AppointmentType; label: string }[] = [
  { value: "atendimento", label: "Atendimento" },
  { value: "entrega", label: "Entrega" },
  { value: "visita", label: "Visita" },
  { value: "reuniao", label: "Reunião" },
  { value: "ligacao", label: "Ligação" },
  { value: "outro", label: "Outro" },
];

export const APPOINTMENT_STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "agendado", label: "Agendado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export const APPOINTMENT_STATUS_COLORS: Record<AppointmentStatus, string> = {
  agendado: "bg-primary/10 text-primary border-primary/20",
  confirmado: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  em_andamento: "bg-warning/10 text-warning border-warning/20",
  concluido: "bg-success/10 text-success border-success/20",
  cancelado: "bg-muted text-muted-foreground border-border",
};

export const APPOINTMENT_TYPE_COLORS: Record<AppointmentType, string> = {
  atendimento: "#2563EB",
  entrega: "#16A34A",
  visita: "#8B5CF6",
  reuniao: "#0EA5E9",
  ligacao: "#EC4899",
  outro: "#64748B",
};

export type CalendarView = "day" | "week" | "month";

export type AppointmentPriority = "baixa" | "media" | "alta" | "urgente";

export const APPOINTMENT_PRIORITY_OPTIONS: { value: AppointmentPriority; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export const APPOINTMENT_PRIORITY_COLORS: Record<AppointmentPriority, string> = {
  baixa: "bg-muted text-muted-foreground border-border",
  media: "bg-primary/10 text-primary border-primary/20",
  alta: "bg-warning/10 text-warning border-warning/20",
  urgente: "bg-danger/10 text-danger border-danger/20",
};

export interface AppointmentFilters {
  from: string; // ISO
  to: string; // ISO
  status?: string;
  type?: string;
  priority?: string;
  customerId?: string;
}
