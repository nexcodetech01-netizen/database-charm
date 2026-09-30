import { memo } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { calcParcela } from "@/lib/pricing/card-price";
import { SummaryLine } from "../summary-line";

export interface MachineFee {
  percent: number;
  fixed: number;
}

interface MachinePaymentPanelProps {
  /** Texto curto do que a operadora deve fazer. */
  instruction: string;
  amount: number;
  fee: MachineFee | null;
  /** Crédito: opções de parcela liberadas para este valor (ex.: [1,2,3]). */
  installmentOptions?: readonly number[];
  installments?: number;
  onInstallmentsChange?: (installments: number) => void;
}

/**
 * Pagamento feito na maquininha (débito, crédito ou PIX): a operadora passa
 * na máquina e confirma aqui. O valor cai na conta da maquininha e a taxa é
 * lançada automaticamente como despesa (ver salesService.autoSettleSale).
 */
export const MachinePaymentPanel = memo(function MachinePaymentPanel({
  instruction,
  amount,
  fee,
  installmentOptions,
  installments = 1,
  onInstallmentsChange,
}: MachinePaymentPanelProps) {
  const feeValue = fee ? Math.round(amount * fee.percent + fee.fixed * 100) / 100 : 0;
  const net = Math.max(0, amount - feeValue);
  const showInstallments = !!installmentOptions && installmentOptions.length > 0;

  return (
    <div className="space-y-3 text-xs">
      <p className="text-sm text-muted-foreground">{instruction}</p>

      {showInstallments ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Parcelas na maquininha</p>
          <div className="flex flex-wrap gap-2">
            {installmentOptions!.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onInstallmentsChange?.(n)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm tabular-nums transition-colors",
                  installments === n
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "hover:bg-muted",
                )}
              >
                {n}x de {formatCurrency(calcParcela(amount, n))}
              </button>
            ))}
          </div>
          {installmentOptions!.length === 1 ? (
            <p className="text-muted-foreground">Parcelamento liberado a partir do valor mínimo configurado.</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1 rounded-md bg-muted/40 p-3">
        <SummaryLine label="Valor da venda" value={formatCurrency(amount)} />
        {fee && feeValue > 0 ? (
          <SummaryLine
            label={`Taxa da maquininha (${fee.percent.toLocaleString("pt-BR")}%${fee.fixed ? ` + ${formatCurrency(fee.fixed)}` : ""})`}
            value={`-${formatCurrency(feeValue)}`}
          />
        ) : null}
        <SummaryLine label="Você receberá" value={formatCurrency(net)} strong />
      </div>
    </div>
  );
});
