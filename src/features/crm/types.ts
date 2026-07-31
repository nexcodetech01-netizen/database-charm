import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type PipelineStage = Tables<"pipeline_stages">;
export type PipelineStageInsert = TablesInsert<"pipeline_stages">;
export type PipelineStageUpdate = TablesUpdate<"pipeline_stages">;

export type Opportunity = Tables<"opportunities">;
export type OpportunityInsert = TablesInsert<"opportunities">;
export type OpportunityUpdate = TablesUpdate<"opportunities">;

export type CrmEvent = Tables<"crm_events">;

export type OpportunityStatus = "open" | "won" | "lost";

export const OPPORTUNITY_STATUS_OPTIONS: { value: OpportunityStatus; label: string }[] = [
  { value: "open", label: "Aberta" },
  { value: "won", label: "Ganha" },
  { value: "lost", label: "Perdida" },
];

export const LEAD_SOURCE_OPTIONS = [
  { value: "indicacao", label: "Indicação" },
  { value: "site", label: "Site" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "outro", label: "Outro" },
];

export const DEFAULT_PIPELINE_STAGES: Array<
  Pick<PipelineStage, "name" | "slug" | "position" | "color" | "is_won" | "is_lost">
> = [
  { name: "Lead", slug: "lead", position: 0, color: "#64748B", is_won: false, is_lost: false },
  { name: "Contato", slug: "contato", position: 1, color: "#0EA5E9", is_won: false, is_lost: false },
  { name: "Proposta", slug: "proposta", position: 2, color: "#8B5CF6", is_won: false, is_lost: false },
  { name: "Negociação", slug: "negociacao", position: 3, color: "#F59E0B", is_won: false, is_lost: false },
  { name: "Fechado", slug: "fechado", position: 4, color: "#16A34A", is_won: true, is_lost: false },
  { name: "Perdido", slug: "perdido", position: 5, color: "#DC2626", is_won: false, is_lost: true },
];
