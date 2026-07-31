import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type SettingsSectionId =
  | "empresa"
  | "cupom"
  | "impressao"
  | "usuarios"
  | "custos-operacionais"
  | "integracoes"
  | "bella-pay"
  | "discount-policy"
  | "whatsapp"
  | "preferencias"
  | "backup"
  | "meios-pagamento"
  | "diagnostico"
  | "sku-cleanup"
  | "pwa";


export type SettingsGroup = "Conta" | "Canais" | "Sistema";

export interface SettingsSectionDefinition {
  id: SettingsSectionId;
  title: string;
  description: string;
  /** "Para que serve" — texto de contexto exibido no header. */
  hint?: string;
  /** "Quando utilizar" — orientação prática. */
  whenToUse?: string;
  icon: LucideIcon;
  group: SettingsGroup;
  component: ComponentType;
  /** Aliases usados pela busca (ex.: "pix", "cartao" → Bella Pay). */
  searchTerms?: string[];
  badge?: { label: string; tone: "new" | "soon" };
}
