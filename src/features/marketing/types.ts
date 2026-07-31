import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type MarketingCampaign = Tables<"marketing_campaigns">;
export type MarketingCampaignInsert = TablesInsert<"marketing_campaigns">;
export type MarketingCampaignUpdate = TablesUpdate<"marketing_campaigns">;

export type CampaignChannel = "whatsapp" | "email" | "instagram" | "facebook" | "google" | "other";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "running"
  | "completed"
  | "paused"
  | "cancelled";

export const CAMPAIGN_CHANNEL_OPTIONS: { value: CampaignChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "other", label: "Outro" },
];

export const CAMPAIGN_STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "scheduled", label: "Agendada" },
  { value: "running", label: "Ativa" },
  { value: "paused", label: "Pausada" },
  { value: "completed", label: "Concluída" },
  { value: "cancelled", label: "Cancelada" },
];

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-primary/10 text-primary border-primary/20",
  running: "bg-success/10 text-success border-success/20",
  paused: "bg-warning/10 text-warning border-warning/20",
  completed: "bg-muted text-foreground border-border",
  cancelled: "bg-danger/10 text-danger border-danger/20",
};

export interface SegmentFilters {
  city?: string;
  state?: string;
  segment?: string;
  purchasedWithinDays?: number | null;
  neverPurchased?: boolean;
  minAverageTicket?: number | null;
  minTotalSpent?: number | null;
}
