import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BellaChatPanel } from "../components";
import { BellaSalesActions } from "./bella-sales-actions";
import { BellaSalesAlerts } from "./bella-sales-alerts";
import { BellaSalesRecommendations } from "./bella-sales-recommendations";
import { BellaSalesSummary } from "./bella-sales-summary";
import { salesLinks } from "./links";
import { useBellaSales } from "./use-bella-sales";

export interface BellaSalesPanelProps {
  companyId: string;
  className?: string;
  hideHeader?: boolean;
  hideSummary?: boolean;
  hideAlerts?: boolean;
  hideRecommendations?: boolean;
  hideActions?: boolean;
}

/**
 * "Bella Vendas" — painel da Bella dentro do módulo Vendas.
 *
 * Somente leitura: consome SalesService, providers, insights e proactive
 * já existentes. Nenhuma venda é criada, alterada ou cancelada aqui;
 * os botões apenas navegam.
 */
export function BellaSalesPanel({ 
  companyId, 
  className,
  hideHeader = false,
  hideSummary = false,
  hideAlerts = false,
  hideRecommendations = false,
  hideActions = false
}: BellaSalesPanelProps) {
  const { view, isLoading } = useBellaSales(companyId);
  const [chatOpen, setChatOpen] = useState(false);

  const criticalCount = view.alerts.filter((a) => a.severity === "critical").length;

  return (
    <Card className={cn("rounded-2xl", className)} data-testid="bella-sales-panel">
      <CardContent className="space-y-4 p-4">
        {!hideHeader && (
          <div className="flex flex-wrap items-start gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Bella Vendas</p>
              <p className="text-xs text-muted-foreground">
                Leitura da Bella sobre o seu comercial — recomendações, nunca ações automáticas.
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
              data-testid="bella-sales-chat-toggle"
            >
              <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Perguntar para Bella
            </Button>
          </div>
        )}

        {!hideSummary && (
          <>
            <BellaSalesSummary
              metrics={view.metrics}
              details={view.details}
              health={view.health}
              loading={isLoading}
            />
            <Separator />
          </>
        )}

        {!hideAlerts && <BellaSalesAlerts alerts={view.alerts} loading={isLoading} />}

        {!hideRecommendations && (
          <BellaSalesRecommendations recommendations={view.recommendations} loading={isLoading} />
        )}

        {!hideActions && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ir para
              </p>
              <BellaSalesActions links={salesLinks()} />
            </div>
          </>
        )}

        {chatOpen ? <BellaChatPanel companyId={companyId} className="border-dashed" /> : null}
      </CardContent>
    </Card>
  );
}
