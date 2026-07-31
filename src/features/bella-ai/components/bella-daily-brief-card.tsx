import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import type { BellaDailyBrief } from "../dashboard";

interface BellaDailyBriefCardProps {
  brief: BellaDailyBrief;
}

/**
 * Cartão do Daily Brief.
 * Renderiza o resumo executivo produzido por `buildDailyBrief` — sem
 * lógica adicional: apenas apresentação.
 */
export function BellaDailyBriefCard({ brief }: BellaDailyBriefCardProps) {
  return (
    <Card className="border-border/70 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">{brief.greeting}</span>
            <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Daily Brief
            </span>
          </div>
          <p className="text-sm leading-relaxed text-foreground">{brief.summaryLine}</p>
          <ul className="space-y-0.5 text-xs leading-relaxed text-muted-foreground">
            <li>• {brief.financeLine}</li>
            <li>• {brief.commercialLine}</li>
            <li>• {brief.prioritiesLine}</li>
          </ul>
          <p className="pt-1 text-xs italic text-muted-foreground">{brief.closingLine}</p>
        </div>
      </CardContent>
    </Card>
  );
}
