import { useState } from "react";
import { MessageCircle, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  collapsible?: boolean;
}

/**
 * "Bella Compras" — painel da Bella dentro do módulo Compras.
 *
 * Somente leitura: consome PurchaseService, InventoryService, providers,
 * insights e proactive já existentes. Nenhum pedido é criado, recebido ou
 * cancelado aqui; os botões apenas navegam.
 */
export function BellaPurchasesPanel({ companyId, className, collapsible }: BellaPurchasesPanelProps) {
  const { view, isLoading } = useBellaPurchases(companyId);
  const [chatOpen, setChatOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(collapsible);

  const criticalCount = view.alerts.filter((a) => a.severity === "critical").length;


  return (
    <Card className={cn("rounded-2xl", className)} data-testid="bella-purchases-panel">
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between space-y-0 p-4",
          collapsible && "cursor-pointer select-none",
        )}
        onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-sm font-semibold leading-tight">
              {collapsible ? "Necessita atenção" : "Bella Compras"}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {isCollapsed
                ? "Clique para ver alertas e recomendações"
                : "Leitura da Bella sobre os seus pedidos — recomendações, nunca ações automáticas."}
            </p>
          </div>
          {criticalCount > 0 ? (
            <Badge variant="destructive" className="ml-2 rounded-lg font-normal">
              {criticalCount} crítico{criticalCount > 1 ? "s" : ""}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <Button
              type="button"
              size="sm"
              variant={chatOpen ? "secondary" : "default"}
              className="rounded-xl h-8"
              aria-expanded={chatOpen}
              onClick={(e) => {
                e.stopPropagation();
                setChatOpen((v) => !v);
              }}
              data-testid="bella-purchases-chat-toggle"
            >
              <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Perguntar para Bella
            </Button>
          )}
          {collapsible && (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="space-y-4 p-4 pt-0">
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
      )}
    </Card>
  );
}
