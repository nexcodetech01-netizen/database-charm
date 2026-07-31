import { Badge } from "@/components/ui/badge";
import {
  ArrowDownRight,
  ArrowUpRight,
  Settings2,
  ArrowLeftRight,
  Bookmark,
  Flag,
} from "lucide-react";
import type { MovementType } from "../types";
import { cn } from "@/lib/utils";

const meta: Record<
  MovementType,
  { label: string; variant: "success" | "danger" | "warning" | "secondary"; icon: typeof ArrowUpRight }
> = {
  in: { label: "Entrada", variant: "success", icon: ArrowUpRight },
  out: { label: "Saída", variant: "danger", icon: ArrowDownRight },
  adjustment: { label: "Ajuste", variant: "warning", icon: Settings2 },
  reservation: { label: "Reserva", variant: "secondary", icon: Bookmark },
  transfer: { label: "Transferência", variant: "secondary", icon: ArrowLeftRight },
  opening: { label: "Saldo inicial", variant: "secondary", icon: Flag },
};

export function MovementTypeBadge({
  type,
  className,
}: {
  type: MovementType | string;
  className?: string;
}) {
  const m = meta[type as MovementType] ?? meta.adjustment;
  const Icon = m.icon;
  return (
    <Badge variant={m.variant} className={cn("gap-1 font-medium", className)}>
      <Icon className="h-3 w-3" />
      {m.label}
    </Badge>
  );
}
