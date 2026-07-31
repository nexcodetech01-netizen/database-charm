import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Boxes,
  DollarSign,
  Package,
  ShoppingCart,
  Sparkles,
  Users,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Indicator, IndicatorPriority } from "../types";

const PRIORITY_STYLE: Record<IndicatorPriority, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-warning/10 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_LABEL: Record<IndicatorPriority, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

const ORIGIN_META = {
  pricing: { label: "Precificação", icon: Sparkles },
  inventory: { label: "Estoque", icon: Boxes },
  sales: { label: "Vendas", icon: ShoppingCart },
  customers: { label: "Clientes", icon: Users },
  finance: { label: "Financeiro", icon: DollarSign },
  purchases: { label: "Compras", icon: Package },
} as const;

function resolveHref(indicator: Indicator): string {
  const { target, entityId } = indicator.action;
  switch (target) {
    case "product":
      return entityId ? `/produtos/${entityId}` : "/produtos";
    case "product_stock":
      return entityId ? `/estoque/produto/${entityId}` : "/estoque";
    case "customer":
      return entityId ? `/clientes/${entityId}` : "/clientes";
    case "purchase":
      return entityId ? `/compras/${entityId}` : "/compras";
    case "sale":
      return entityId ? `/vendas/${entityId}` : "/vendas";
    case "finance":
      return "/financeiro";
    case "simulator":
      return "/inteligencia-comercial/simulador";
    case "review":
      return "/inteligencia-comercial/revisao-precos";
    case "dashboard":
    default:
      return "/dashboard";
  }
}

interface Props {
  indicator: Indicator;
  onResolve?: (id: string) => void;
  resolved?: boolean;
}

export function IndicatorCard({ indicator, onResolve, resolved }: Props) {
  const originMeta = ORIGIN_META[indicator.origin];
  const OriginIcon = originMeta.icon;
  const navigate = useNavigate();
  const href = resolveHref(indicator);

  return (
    <Card
      className={cn(
        "border-border/70 transition-colors hover:border-primary/40",
        resolved && "opacity-60",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-md border",
                PRIORITY_STYLE[indicator.priority],
              )}
              aria-hidden
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold">{indicator.title}</p>
                <Badge variant="outline" className={cn("text-[10px]", PRIORITY_STYLE[indicator.priority])}>
                  {PRIORITY_LABEL[indicator.priority]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {indicator.description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <OriginIcon className="h-3 w-3" />
            {originMeta.label}
          </span>
          <span>·</span>
          <span className="font-medium text-foreground">{indicator.impact}</span>
          <span>·</span>
          <span>{indicator.date ? formatDate(indicator.date.slice(0, 10)) : "—"}</span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          {onResolve ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => onResolve(indicator.id)}
            >
              {resolved ? "Reabrir" : "Marcar como resolvido"}
            </Button>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            variant="default"
            className="text-xs"
            onClick={() => navigate({ to: href })}
          >
            {indicator.action.label}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
