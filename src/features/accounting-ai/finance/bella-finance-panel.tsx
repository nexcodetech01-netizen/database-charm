import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BellaChatPanel } from "../components";
import { BellaFinanceActions } from "./bella-finance-actions";
import { BellaFinanceAlerts } from "./bella-finance-alerts";
import { BellaFinanceRecommendations } from "./bella-finance-recommendations";
import { BellaFinanceSummary } from "./bella-finance-summary";
import { financeLinks } from "./links";
import { useBellaFinance } from "./use-bella-finance";

export interface BellaFinancePanelProps {
  companyId: string;
  className?: string;
}

/**
 * "Bella Financeira" — painel da Bella dentro do módulo Financeiro.
 *
 * Somente leitura: consome providers, advisor, insights e proactive já
 * existentes. Não executa nenhuma ação financeira; os botões apenas navegam.
 */
export function BellaFinancePanel({ companyId, className }: BellaFinancePanelProps) {
  const { view, isLoading } = useBellaFinance(companyId);
  const [chatOpen, setChatOpen] = useState(false);

  const criticalCount = view.alerts.filter((a) => a.severity === "critical").length;

  return (
    <Card className={cn("rounded-2xl", className)} data-testid="bella-finance-panel">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Bella Financeira</p>
            <p className="text-xs text-muted-foreground">
              Leitura da Bella sobre o seu financeiro — recomendações, nunca ações automáticas.
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
            data-testid="bella-finance-chat-toggle"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Perguntar para Bella
          </Button>
        </div>

        <BellaFinanceSummary
          metrics={view.metrics}
          details={view.details}
          health={view.health}
          loading={isLoading}
        />

        {view.advice?.available ? (
          <p className="rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
            {view.advice.message}
          </p>
        ) : null}

        <Separator />

        <BellaFinanceAlerts alerts={view.alerts} loading={isLoading} />

        <BellaFinanceRecommendations recommendations={view.recommendations} loading={isLoading} />

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ir para
          </p>
          <BellaFinanceActions links={financeLinks()} />
        </div>

        {chatOpen ? <BellaChatPanel companyId={companyId} className="border-dashed" /> : null}
      </CardContent>
    </Card>
  );
}
