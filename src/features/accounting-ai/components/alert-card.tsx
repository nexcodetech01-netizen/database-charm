import type { ReactNode } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export type AlertTone = "info" | "warning" | "critical";

/** AlertCard — apresentação de alerta. Nenhuma regra decide o tom aqui. */
export interface AlertCardProps {
  title: ReactNode;
  description?: ReactNode;
  tone?: AlertTone;
  className?: string;
}

const TONES: Record<AlertTone, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "border-border bg-muted/40 text-foreground" },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-500/40 bg-amber-500/10 text-foreground",
  },
  critical: {
    icon: ShieldAlert,
    className: "border-destructive/40 bg-destructive/10 text-foreground",
  },
};

export function AlertCard({ title, description, tone = "info", className }: AlertCardProps) {
  const { icon: Icon, className: toneClass } = TONES[tone];
  return (
    <Card className={cn("rounded-2xl", toneClass, className)}>
      <CardContent className="flex gap-3 p-4">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
