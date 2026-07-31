/**
 * BellaActionCard — apresenta um `ActionProposal` no chat da Bella e exige
 * confirmação humana explícita. Nenhuma lógica de negócio aqui: a UI apenas
 * dispara callbacks (`onConfirm` / `onCancel`) que consultam server functions.
 */
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import type { ActionProposal } from "@/features/bella-ai/ai";

interface BellaActionCardProps {
  readonly proposal: ActionProposal;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly onConfirm: (proposal: ActionProposal) => void;
  readonly onCancel: (proposal: ActionProposal) => void;
}

const toneClass: Record<string, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-rose-600 dark:text-rose-400",
  warning: "text-amber-600 dark:text-amber-400",
  neutral: "text-muted-foreground",
};

export function BellaActionCard({
  proposal,
  loading,
  disabled,
  onConfirm,
  onCancel,
}: BellaActionCardProps) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold">
            {proposal.title}
          </CardTitle>
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Requer confirmação
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{proposal.summary}</p>
      </CardHeader>

      <CardContent className="space-y-3">
        {proposal.impact.length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {proposal.impact.map((row) => (
              <div key={row.label} className="flex flex-col">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className={`font-medium ${toneClass[row.tone ?? "neutral"]}`}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {proposal.risks.length > 0 ? (
          <ul className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            {proposal.risks.map((r) => (
              <li key={r.code} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{r.message}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>

      <CardFooter className="justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={loading || disabled}
          onClick={() => onCancel(proposal)}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={loading || disabled}
          onClick={() => onConfirm(proposal)}
        >
          {loading ? "Aplicando..." : "Confirmar"}
        </Button>
      </CardFooter>
    </Card>
  );
}
