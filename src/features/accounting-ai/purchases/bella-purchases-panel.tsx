import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BellaChatPanel } from "../components";
import { BellaPurchasesActions } from "./bella-purchases-actions";
import { BellaPurchasesAlerts } from "./bella-purchases-alerts";
import { BellaPurchasesRecommendations } from "./bella-purchases-recommendations";
import { BellaPurchasesSummary } from "./bella-purchases-summary";
import { purchasesLinks } from "./links";
import { useBellaPurchases } from "./use-bella-purchases";

export interface BellaPurchasesPanelProps {
  companyId: string;
  className?: string;
}

/**
 * "Bella Compras" — painel da Bella dentro do módulo Compras.
 *
 * Somente leitura: consome PurchaseService, InventoryService, providers,
 * insights e proactive já existentes. Nenhum pedido é criado, recebido ou
 * cancelado aqui; os botões apenas navegam.
 */
export function BellaPurchasesPanel({ companyId, className }: BellaPurchasesPanelProps) {
  const { view, isLoading } = useBellaPurchases(companyId);
  const [chatOpen, setChatOpen] = useState(false);

  const criticalCount = view.alerts.filter((a) => a.severity === "critical").length;

  return (
    <Card className={cn("rounded-2xl", className)} data-testid="bella-purchases-panel">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Bella Compras</p>
            <p className="text-xs text-muted-foreground">
              Leitura da Bella sobre os seus pedidos — recomendações, nunca ações automáticas.
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
            data-testid="bella-purchases-chat-toggle"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Perguntar para Bella
          </Button>
        </div>

        <BellaPurchasesSummary
          metrics={view.metrics}
          details={view.details}
          health={view.health}
          loading={isLoading}
        />

        <Separator />

        <BellaPurchasesAlerts alerts={view.alerts} loading={isLoading} />

        <BellaPurchasesRecommendations
          recommendations={view.recommendations}
          loading={isLoading}
        />

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ir para
          </p>
          <BellaPurchasesActions links={purchasesLinks()} />
        </div>

        {chatOpen ? <BellaChatPanel companyId={companyId} className="border-dashed" /> : null}
      </CardContent>
    </Card>
  );
}
