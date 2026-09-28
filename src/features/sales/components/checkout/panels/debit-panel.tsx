import { memo } from "react";
import { formatCurrency } from "@/lib/format";
import { SummaryLine } from "../summary-line";

interface DebitPanelProps {
  amount: number;
  debitSnapshot: { percent: number; fixed: number } | undefined;
  debitFee: number;
  debitNet: number;
}

export const DebitPanel = memo(function DebitPanel({
  amount,
  debitSnapshot,
  debitFee,
  debitNet,
}: DebitPanelProps) {
  return (
    <div className="space-y-2 text-xs">
      <div className="text-sm text-muted-foreground">
        Baixa manual do débito (sem TEF integrado).
      </div>
      {debitSnapshot ? (
        <div className="space-y-1 rounded-md bg-muted/40 p-3">
          <SummaryLine label="Valor da venda" value={formatCurrency(amount)} />
          <SummaryLine
            label={`Taxa (${debitSnapshot.percent}%${debitSnapshot.fixed ? ` + ${formatCurrency(debitSnapshot.fixed)}` : ""})`}
            value={`-${formatCurrency(debitFee)}`}
          />
          <SummaryLine label="Você receberá" value={formatCurrency(debitNet)} strong />
        </div>
      ) : null}
    </div>
  );
});
