import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { useAccounts } from "@/features/finance";
import type { FinancePaymentMethod } from "@/features/finance/types";
import { PDV_PAYMENT_METHODS } from "../lib/receiving";

type Props = {
  companyId: string;
  saleNumber: string;
  total: number;
  isReceiving: boolean;
  onConfirm: (input: {
    paymentMethod: FinancePaymentMethod | "";
    accountId: string;
  }) => void;
};

/**
 * PDV — painel de recebimento (Sprint 2.5). Exibido somente depois que a
 * venda foi criada. Toda a liquidação é executada pelo motor financeiro
 * existente; aqui só se escolhe forma de recebimento e conta de destino.
 */
export function PDVReceivePanel({
  companyId,
  saleNumber,
  total,
  isReceiving,
  onConfirm,
}: Props) {
  const { data: accounts } = useAccounts(companyId);
  const activeAccounts = (accounts ?? []).filter((a) => a.status === "active");

  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentMethod | "">("");
  const [accountId, setAccountId] = useState("");

  return (
    <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold">Recebimento</p>
        <p className="text-xs text-muted-foreground">
          Venda {saleNumber} · {formatCurrency(total)}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Forma de recebimento</Label>
        <Select
          value={paymentMethod || undefined}
          onValueChange={(v) => setPaymentMethod(v as FinancePaymentMethod)}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {PDV_PAYMENT_METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Conta de destino</Label>
        <Select value={accountId || undefined} onValueChange={setAccountId}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Selecione a conta" />
          </SelectTrigger>
          <SelectContent>
            {activeAccounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        id="pdv-receive-confirm"
        className="h-12 w-full text-base"
        disabled={isReceiving || !paymentMethod || !accountId}
        onClick={() => onConfirm({ paymentMethod, accountId })}
      >
        {isReceiving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Registrando...
          </>
        ) : (
          "Confirmar recebimento"
        )}
      </Button>
    </div>
  );
}
