import type { LucideIcon } from "lucide-react";
import { TrendingDown, PackageSearch, Users, Target } from "lucide-react";

export type MissionPriority = "critical" | "high" | "medium" | "low";
export type MissionStatus = "active" | "paused" | "completed";

export interface MissionAction {
  id: string;
  label: string;
  done?: boolean;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  progress: number;
  priority: MissionPriority;
  status: MissionStatus;
  actions: MissionAction[];
  icon: LucideIcon;
  tone: string;
}

export const MISSION_PRIORITY_LABEL: Record<MissionPriority, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
};

export const MISSIONS: Mission[] = [
  {
    id: "mission-collection",
    title: "Reduzir inadimplência",
    description: "Levar inadimplência para menos de 5% até o fim do mês.",
    progress: 62,
    priority: "high",
    status: "active",
    icon: TrendingDown,
    tone: "bg-danger/10 text-danger",
    actions: [
      { id: "a1", label: "Cobrar clientes em atraso" },
      { id: "a2", label: "Enviar lembretes automáticos" },
      { id: "a3", label: "Revisar pagamentos parciais" },
    ],
  },
  {
    id: "mission-stock-turn",
    title: "Girar produtos parados",
    description: "Escoar 30 SKUs com giro baixo há mais de 60 dias.",
    progress: 34,
    priority: "medium",
    status: "active",
    icon: PackageSearch,
    tone: "bg-warning/10 text-warning",
    actions: [
      { id: "a1", label: "Criar coleção promocional" },
      { id: "a2", label: "Divulgar no WhatsApp" },
      { id: "a3", label: "Ajustar preço mínimo" },
    ],
  },
  {
    id: "mission-reactivation",
    title: "Ativar clientes recorrentes",
    description: "Reengajar clientes sem compra nos últimos 90 dias.",
    progress: 18,
    priority: "medium",
    status: "active",
    icon: Users,
    tone: "bg-primary/10 text-primary",
    actions: [
      { id: "a1", label: "Segmentar por ticket médio" },
      { id: "a2", label: "Enviar campanha personalizada" },
      { id: "a3", label: "Oferecer cupom de retorno" },
    ],
  },
  {
    id: "mission-margin",
    title: "Proteger margem em Bolsas",
    description: "Recuperar margem alvo de 55% na categoria estratégica.",
    progress: 8,
    priority: "high",
    status: "active",
    icon: Target,
    tone: "bg-primary/10 text-primary",
    actions: [
      { id: "a1", label: "Revisar política de desconto" },
      { id: "a2", label: "Renegociar com fornecedor" },
      { id: "a3", label: "Ajustar preços da coleção" },
    ],
  },
];
