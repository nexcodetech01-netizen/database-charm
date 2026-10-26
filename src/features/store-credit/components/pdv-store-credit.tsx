import { useEffect } from "react";
import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { useStoreCreditBalance } from "../hooks/use-store-credit";

interface Props {
  customerId: string;
  /** Total da venda antes do vale-troca. */
  totalBeforeCredit: number;
  value: number;
  onChange: (value: number) => void;
  readOnly?: boolean;
}

/** PDV: mostra o vale-troca da cliente e deixa usar na venda. */
export function PdvStoreCredit({
  customerId,
  totalBeforeCredit,
  value,
  onChange,
  readOnly,
}: Props) {
  const { data: balance } = useStoreCreditBalance(customerId || null);
  const available = Math.max(0, balance ?? 0);
  const max = Math.max(0, Math.min(available, totalBeforeCredit));
  const round = (n: number) => Math.round(n * 100) / 100;

  // Carrinho diminuiu (ou saldo mudou): o vale nunca passa do total.
  useEffect(() => {
    if (!readOnly && value > max + 0.004) onChange(round(max));
  }, [max, value, onChange, readOnly]);

  if (!customerId || (available <= 0 && value <= 0)) return null;

  const using = value > 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
      <Repeat className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {using ? `Vale-troca: −${formatCurrency(value)}` : "Cliente tem vale-troca"}
        </p>
        <p className="text-xs text-muted-foreground">
          {using
            ? `Sobra ${formatCurrency(Math.max(0, available - value))} de saldo`
            : `${formatCurrency(available)} disponível`}
        </p>
      </div>
      {readOnly ? null : using ? (
        <Button size="sm" variant="ghost" onClick={() => onChange(0)}>
          Não usar
        </Button>
      ) : (
        <Button size="sm" onClick={() => onChange(round(max))} disabled={max <= 0}>
          Usar
        </Button>
      )}
    </div>
  );
}
