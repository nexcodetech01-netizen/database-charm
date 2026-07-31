import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { BellaInlineSuggestion } from "@/features/bella-ai/components/bella-inline-suggestion";
import { useBellaPayCharges } from "@/features/bella-pay/hooks/use-bella-pay";
import {
  derivePendencies,
  summarize,
  ISSUE_LABEL,
  ISSUE_TONE,
  originLabel,
} from "../lib/reconciliation";

interface Props {
  companyId: string;
}

/**
 * FIN-004 — Pendências de Conciliação.
 * Reutiliza `useBellaPayCharges` (já em cache) e apenas deriva no cliente
 * as cobranças que precisam de atenção. Sem novas telas, sem novo módulo,
 * sem alteração em backend.
 */
export function ReconciliationPanel({ companyId }: Props) {
  const { data: charges = [], isLoading } = useBellaPayCharges(companyId);

  const pendencies = useMemo(() => derivePendencies(charges), [charges]);
  const summary = useMemo(() => summarize(charges), [charges]);

  const bella = pickSuggestion(summary, pendencies.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Pendências de conciliação</h2>
          <p className="text-sm text-muted-foreground">
            Cobranças do Asaas que precisam de atenção. As demais foram
            conciliadas automaticamente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            {summary.autoReconciledToday} conciliada(s) hoje
          </Badge>
          {summary.divergenceCount > 0 ? (
            <Badge variant="outline" className="gap-1.5 border-destructive/30 text-destructive">
              {summary.divergenceCount} divergência(s)
            </Badge>
          ) : null}
          {summary.pendingCount > 0 ? (
            <Badge variant="outline" className="gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-400">
              {summary.pendingCount} sem vínculo
            </Badge>
          ) : null}
        </div>
      </div>

      {bella ? (
        <BellaInlineSuggestion
          tone={bella.tone}
          title={bella.title}
          message={bella.message}
          action={bella.action}
        />
      ) : null}

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cobrança</TableHead>
                <TableHead className="hidden md:table-cell">Origem</TableHead>
                <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="hidden sm:table-cell">Situação</TableHead>
                <TableHead className="w-[140px] text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pendencies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16">
                    <EmptyState
                      autoReconciled={summary.autoReconciledToday}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pendencies.map(({ charge, issue, expected, received, diff }) => (
                  <TableRow key={charge.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {charge.description ?? `Cobrança ${charge.asaas_id}`}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {charge.customer_name ?? "Sem cliente"}
                          {charge.sale_number
                            ? ` · Venda #${charge.sale_number}`
                            : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {originLabel(charge)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {formatDate(charge.due_date)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(expected)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={cn(
                          issue === "value_mismatch" && "text-destructive font-medium",
                        )}
                      >
                        {formatCurrency(received)}
                      </span>
                      {issue === "value_mismatch" && diff > 0 ? (
                        <div className="text-xs text-destructive">
                          Δ {formatCurrency(diff)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={ISSUE_TONE[issue]}>
                        {ISSUE_LABEL[issue]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {charge.sale_id ? (
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to="/vendas/$saleId"
                            params={{ saleId: charge.sale_id }}
                          >
                            Ver venda
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      ) : charge.invoice_url ? (
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={charge.invoice_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir
                            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
          <div>
            <p className="font-medium text-foreground">
              Conciliação automática ativa
            </p>
            <p className="mt-1 leading-relaxed">
              O NexOS concilia PIX, Boleto, Cartão e Link de pagamento assim
              que o Asaas confirma. Status, valor recebido, data e histórico
              são atualizados sem intervenção manual. Só aparece aqui o que
              precisa da sua atenção.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ autoReconciled }: { autoReconciled: number }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
      <CheckCircle2 className="h-8 w-8 text-success" />
      <p className="font-medium text-foreground">Tudo conciliado.</p>
      <p className="text-xs">
        {autoReconciled > 0
          ? `${autoReconciled} cobrança(s) conciliada(s) automaticamente hoje.`
          : "Nenhuma pendência no momento."}
      </p>
    </div>
  );
}

function pickSuggestion(
  s: ReturnType<typeof summarize>,
  pendCount: number,
): {
  tone: "info" | "warning" | "danger";
  title: string;
  message: string;
  action?: { label: string; to?: string; onClick?: () => void };
} | null {
  if (s.divergenceCount > 0) {
    return {
      tone: "danger",
      title:
        s.divergenceCount === 1
          ? "Existe uma cobrança com diferença de valor."
          : `${s.divergenceCount} cobranças com diferença de valor.`,
      message:
        s.totalDiff > 0
          ? `Divergência total de ${formatCurrency(s.totalDiff)}. Revise os detalhes abaixo.`
          : "Revise os detalhes abaixo.",
    };
  }
  if (s.pendingCount > 0) {
    return {
      tone: "warning",
      title: `${s.pendingCount} pagamento(s) aguardando vínculo.`,
      message:
        "O Asaas confirmou, mas ainda não vinculamos ao financeiro. Confirme abaixo.",
    };
  }
  if (pendCount === 0 && s.autoReconciledToday > 0) {
    return {
      tone: "info",
      title: `${s.autoReconciledToday} cobrança(s) conciliada(s) automaticamente.`,
      message: "Nenhuma ação necessária. Continue operando normalmente.",
    };
  }
  return null;
}
