import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  APPOINTMENT_STATUS_COLORS,
  APPOINTMENT_STATUS_OPTIONS,
  type AppointmentStatus,
} from "../types";

export function AppointmentStatusBadge({ status }: { status: string }) {
  const label =
    APPOINTMENT_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
  const cls = APPOINTMENT_STATUS_COLORS[status as AppointmentStatus] ?? "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("border font-medium", cls)}>
      {label}
    </Badge>
  );
}
