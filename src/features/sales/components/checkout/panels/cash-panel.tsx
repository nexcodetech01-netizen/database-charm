import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

interface CashPanelProps {
  amount: number;
  cashReceivedStr: string;
  onCashReceivedChange: (value: string) => void;
  cashShort: number;
  cashChange: number;
}

export const CashPanel = memo(function CashPanel({
  amount,
  cashReceivedStr,
  onCashReceivedChange,
  cashShort,
  cashChange,
}: CashPanelProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
          Valor recebido
        </Label>
        <Input
          inputMode="decimal"
          placeholder={formatCurrency(amount)}
          value={cashReceivedStr}
          onChange={(e) => onCashReceivedChange(e.target.value)}
          className="text-lg tabular-nums"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-muted/40 p-2">
          <div className="text-muted-foreground">Total</div>
          <div className="font-semibold tabular-nums">{formatCurrency(amount)}</div>
        </div>
        <div
          className={cn(
            "rounded-md p-2",
            cashShort > 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          )}
        >
          <div className="opacity-80">{cashShort > 0 ? "Falta" : "Troco"}</div>
          <div className="font-semibold tabular-nums">
            {formatCurrency(cashShort > 0 ? cashShort : cashChange)}
          </div>
        </div>
      </div>
    </div>
  );
});
