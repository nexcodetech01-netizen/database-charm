import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BellaChatPanel } from "../components";
import { BellaInventoryActions } from "./bella-inventory-actions";
import { BellaInventoryAlerts } from "./bella-inventory-alerts";
import { BellaInventoryRecommendations } from "./bella-inventory-recommendations";
import { BellaInventorySummary } from "./bella-inventory-summary";
import { inventoryLinks } from "./links";
import { useBellaInventory } from "./use-bella-inventory";

export interface BellaInventoryPanelProps {
  companyId: string;
  className?: string;
}

/**
 * "Bella Estoque" — painel da Bella dentro do módulo Estoque.
 *
 * Somente leitura: consome InventoryService, providers, insights e proactive
 * já existentes. Nenhuma movimentação, ajuste ou recálculo é executado;
 * os botões apenas navegam.
 */
export function BellaInventoryPanel({ companyId, className }: BellaInventoryPanelProps) {
  const { view, isLoading } = useBellaInventory(companyId);
  const [chatOpen, setChatOpen] = useState(false);

  const criticalCount = view.alerts.filter((a) => a.severity === "critical").length;

  return (
    <Card className={cn("rounded-2xl", className)} data-testid="bella-inventory-panel">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Bella Estoque</p>
            <p className="text-xs text-muted-foreground">
              Leitura da Bella sobre o seu estoque — recomendações, nunca ações automáticas.
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
            data-testid="bella-inventory-chat-toggle"
          >
            <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Perguntar para Bella
          </Button>
        </div>

        <BellaInventorySummary
          metrics={view.metrics}
          details={view.details}
          health={view.health}
          loading={isLoading}
        />

        <Separator />

        <BellaInventoryAlerts alerts={view.alerts} loading={isLoading} />

        <BellaInventoryRecommendations
          recommendations={view.recommendations}
          loading={isLoading}
        />

        <Separator />

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ir para
          </p>
          <BellaInventoryActions links={inventoryLinks()} />
        </div>

        {chatOpen ? <BellaChatPanel companyId={companyId} className="border-dashed" /> : null}
      </CardContent>
    </Card>
  );
}
