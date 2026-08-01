import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BellaChatPanel } from "../components";
import { BellaFiscalActions } from "./bella-fiscal-actions";
import { BellaFiscalAlerts } from "./bella-fiscal-alerts";
import { BellaFiscalRecommendations } from "./bella-fiscal-recommendations";
import { BellaFiscalSummary } from "./bella-fiscal-summary";
import { fiscalLinks } from "./links";
import { useBellaFiscal } from "./use-bella-fiscal";

export interface BellaFiscalPanelProps {
  companyId: string;
  className?: string;
}

/**
 * "Bella Fiscal" — painel da Bella dentro do módulo Fiscal.
 *
 * Somente leitura: consome Fiscal v2, providers, insights e proactive já
 * existentes. Nenhuma emissão, cancelamento ou reprocessamento é executado;
 * os botões apenas navegam.
 */
export function BellaFiscalPanel({ companyId, className }: BellaFiscalPanelProps) {
  const { view, isLoading } = useBellaFiscal(companyId);
  const [chatOpen, setChatOpen] = useState(false);

  const criticalCount = view.alerts.filter((a) => a.severity === "critical").length;

  return (
    <Card className={cn("rounded-2xl", className)} data-testid="bella-fiscal-panel">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Bella Fiscal</p>
            <p className="text-xs text-muted-foreground">
              Leitura da Bella sobre o seu fiscal — recomendações, nunca ações automáticas.
            </p>
          </div>
          {criticalCount > 0 ? (
            <Badge variant="destructive" className="rounded-lg font-normal">
              {criticalCount} crítico{criticalCount > 1 ? "s" : ""}
            </Badge>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={chatOpen ? "secondary" : "default"}
            className="rounded-xl"
            aria-expanded={chatOpen}
            onClick={() => setChatOpen((v) => !v)}
            data-testid="bella-fiscal-chat-toggle"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Perguntar para Bella
          </Button>
        </div>

        <BellaFiscalSummary
          metrics={view.metrics}
          details={view.details}
          health={view.health}
          loading={isLoading}
        />

        <Separator />

        <BellaFiscalAlerts alerts={view.alerts} loading={isLoading} />

        <BellaFiscalRecommendations recommendations={view.recommendations} loading={isLoading} />

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ir para
          </p>
          <BellaFiscalActions links={fiscalLinks()} />
        </div>

        {chatOpen ? <BellaChatPanel companyId={companyId} className="border-dashed" /> : null}
      </CardContent>
    </Card>
  );
}
