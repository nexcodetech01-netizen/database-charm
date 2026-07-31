import { AlertTriangle, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  useWhatsAppMonthlyUsage,
  WHATSAPP_MONITORING_THRESHOLD,
} from "@/features/whatsapp/hooks/use-whatsapp-usage";
import { cn } from "@/lib/utils";

// Custo estimado por mensagem (USD) e cotação padrão BRL/USD.
// TODO: substituir DEFAULT_USD_BRL_RATE por cotação vinda de configuração do sistema quando disponível.
export const COST_PER_MESSAGE_USD = 0.0068;
export const DEFAULT_USD_BRL_RATE = 5.5;

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

export function WhatsAppUsageCard({ companyId }: { companyId: string }) {
  const { data, isLoading } = useWhatsAppMonthlyUsage(companyId);
  const count = data?.count ?? 0;
  const threshold = data?.threshold ?? WHATSAPP_MONITORING_THRESHOLD;
  const warning = data?.warning ?? false;
  const monthLabel = data
    ? MONTH_LABEL.format(new Date(data.monthStart))
    : MONTH_LABEL.format(new Date());

  const usdBrlRate = DEFAULT_USD_BRL_RATE;
  const estimatedCostBRL = count * COST_PER_MESSAGE_USD * usdBrlRate;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors",
        warning &&
          "border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent",
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            WhatsApp — mensagens enviadas
          </p>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {formatNumber(count)}
            </p>
          )}
          {isLoading ? (
            <Skeleton className="mt-1 h-4 w-32" />
          ) : (
            <p className="text-xs text-muted-foreground">
              Custo estimado:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(estimatedCostBRL)}
              </span>
            </p>
          )}
          <p className="text-xs capitalize text-muted-foreground">
            {monthLabel} · monitoramento a partir de {formatNumber(threshold)}
          </p>
          {warning ? (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Limite inicial de monitoramento de {formatNumber(threshold)} mensagens no
                mês alcançado. O envio segue funcionando normalmente.
              </span>
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
            warning
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-primary/10 text-primary",
          )}
          aria-hidden="true"
        >
          <MessageCircle className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
