import { useState } from "react";
import { HandCoins, ShieldCheck, Wallet, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FinancialAdvice } from "../advisor";
import { ProlaboreWithdrawalDialog } from "./prolabore-withdrawal-dialog";

export interface AdvisorCardProps {
  advice: FinancialAdvice | null;
  loading?: boolean;
  companyId?: string;
  onWithdrawalCompleted?: () => void;
}

const RISK_TONE: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-warning/10 text-warning",
  high: "bg-danger/10 text-danger",
  critical: "bg-danger/10 text-danger",
  unknown: "bg-muted text-muted-foreground",
};

/**
 * Card "Consultoria Financeira" — apresentação pura do `FinancialAdvice`.
 * Não calcula nada e não dispara nenhuma ação.
 */
export function AdvisorCard({ advice, loading = false, companyId, onWithdrawalCompleted }: AdvisorCardProps) {
  const unavailable = !advice || !advice.available;
  const [dialogOpen, setDialogOpen] = useState(false);

  const items = [
    {
      key: "available",
      label: "Valor disponível",
      icon: Wallet,
      value: advice ? formatCurrency(advice.availableCash) : "—",
      tone: "bg-primary/10 text-primary",
    },
    {
      key: "reserve",
      label: "Reserva recomendada",
      icon: ShieldCheck,
      value: advice ? formatCurrency(advice.reserve.recommended) : "—",
      tone: "bg-primary/10 text-primary",
    },
    {
      key: "safe",
      label: "Retirada segura",
      icon: HandCoins,
      value: advice ? formatCurrency(advice.withdrawal.safeAmount) : "—",
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "risk",
      label: "Risco financeiro",
      icon: TriangleAlert,
      value: advice ? advice.risk.label : "—",
      tone: RISK_TONE[advice?.risk.level ?? "unknown"] ?? RISK_TONE.unknown,
    },
  ];

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Consultoria financeira</p>
            <p className="text-xs text-muted-foreground">
              Quanto pode ser retirado do caixa com segurança hoje.
            </p>
          </div>
          {companyId && (
            <Button
              size="sm"
              disabled={unavailable || loading}
              onClick={() => setDialogOpen(true)}
            >
              <HandCoins className="mr-1.5 h-4 w-4" /> Registrar retirada
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map(({ key, label, icon: Icon, value, tone }) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-border/50"
            >
              <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <div
                  className={cn(
                    "truncate text-base font-semibold tabular-nums",
                    (loading || unavailable) && "text-muted-foreground",
                  )}
                >
                  {loading ? "…" : unavailable ? "—" : value}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {loading
            ? "Analisando os dados do período…"
            : unavailable
              ? "Não há dados suficientes para recomendar uma retirada."
              : advice.message}
        </p>
      </CardContent>
      {companyId && (
        <ProlaboreWithdrawalDialog
          companyId={companyId}
          advice={advice}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCompleted={onWithdrawalCompleted}
        />
      )}
    </Card>
  );
}
