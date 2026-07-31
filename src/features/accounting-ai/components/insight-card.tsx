import type { ReactNode } from "react";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/** InsightCard — bloco de leitura para observações da Bella (sem lógica). */
export interface InsightCardProps {
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function InsightCard({ title, description, footer, className }: InsightCardProps) {
  return (
    <Card className={cn("rounded-2xl", className)}>
      <CardContent className="flex gap-3 p-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Lightbulb className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
          {footer ? <div className="pt-1 text-xs text-muted-foreground">{footer}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
