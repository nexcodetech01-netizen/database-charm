import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InterestInsight } from "../lib/interest-insights";

const TONE_CLASS: Record<InterestInsight["tone"], string> = {
  info: "border-info/30 bg-info/5 text-info-foreground",
  success: "border-success/30 bg-success/5 text-success-foreground",
  warning: "border-warning/30 bg-warning/5 text-warning-foreground",
};

/**
 * Avisos determinísticos da Bella sobre a Lista de Interesse.
 * READ ONLY: apenas informa a equipe — nenhuma mensagem é enviada ao cliente.
 */
export function InterestBellaHints({ insights }: { insights: InterestInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="space-y-2">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
            TONE_CLASS[insight.tone],
          )}
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{insight.text}</span>
        </div>
      ))}
    </div>
  );
}
