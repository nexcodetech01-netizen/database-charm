import { memo } from "react";
import { formatCurrency } from "@/lib/format";
import { SummaryLine } from "./summary-line";

interface CheckoutSummaryProps {
  amount: number;
  subtotal?: number;
  discount?: number;
  shipping?: number;
  entradaValue: number;
  saldoValue: number;
  saldoDueDate: string;
}

/** Bloco "Total a receber" com resumo (subtotal, desconto, frete, entrada, saldo). */
export const CheckoutSummary = memo(function CheckoutSummary({
  amount,
  subtotal,
  discount,
  shipping,
  entradaValue,
  saldoValue,
  saldoDueDate,
}: CheckoutSummaryProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Total a receber
      </div>
      <div className="mt-1 text-4xl font-bold tabular-nums text-gray-100">
        {formatCurrency(amount)}
      </div>

      {/* FIN-001 — resumo em tempo real (subtotal, desconto, frete, entrada, saldo) */}
      {(subtotal != null || discount != null || shipping != null || entradaValue > 0) ? (
        <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs">
          {subtotal != null ? (
            <SummaryLine label="Subtotal" value={formatCurrency(subtotal)} />
          ) : null}
          {discount != null && discount > 0 ? (
            <SummaryLine label="Desconto" value={`-${formatCurrency(discount)}`} />
          ) : null}
          {shipping != null && shipping > 0 ? (
            <SummaryLine label="Frete" value={`+${formatCurrency(shipping)}`} />
          ) : null}
          <SummaryLine label="Total da Venda" value={formatCurrency(amount)} strong />
          {entradaValue > 0 ? (
            <>
              <SummaryLine label="Valor Pago (Entrada)" value={formatCurrency(entradaValue)} className="text-success" />
              <SummaryLine label="Saldo Devedor / Restante" value={formatCurrency(saldoValue)} strong className="text-destructive font-bold" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Vencimento do saldo</span>
                <span>{new Date(saldoDueDate + "T00:00:00").toLocaleDateString("pt-BR")}</span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
