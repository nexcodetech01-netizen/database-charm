import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  MinusCircle,
  PlusCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportPreviewSummary } from "../types";

/**
 * Painel visual de pré-visualização de importação.
 * Mostra contadores por categoria. Sem parser real.
 */
export function ImportPreviewSummaryCard({
  summary,
}: {
  summary: ImportPreviewSummary;
}) {
  const items: { key: keyof ImportPreviewSummary; label: string; icon: LucideIcon; tone: string }[] = [
    { key: "created", label: "Novos", icon: PlusCircle, tone: "text-emerald-600 dark:text-emerald-400" },
    { key: "updated", label: "Atualizações", icon: CheckCircle2, tone: "text-primary" },
    { key: "ignored", label: "Ignorados", icon: MinusCircle, tone: "text-muted-foreground" },
    { key: "duplicated", label: "Duplicados", icon: Copy, tone: "text-warning" },
    { key: "errors", label: "Erros", icon: AlertTriangle, tone: "text-red-600 dark:text-red-400" },
  ];

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-md border bg-card/60 p-3"
            >
              <Icon className={cn("h-5 w-5 shrink-0", item.tone)} />
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {summary[item.key].toLocaleString("pt-BR")}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
