import { useEffect, useMemo, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { CREDIT_PAYMENT_METHOD_OPTIONS } from "../types";
import { useReceiveCreditPayment } from "../hooks/use-credit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  creditAccountId: string;
  balance: number;
  saleId?: string;
  customerId?: string | null;
  onPaid?: (result: { balance: number; settled: boolean }) => void;
}

/**
 * Diálogo reutilizável para registrar recebimento de crediário.
 * Chama a RPC receive_credit_payment via serviço central.
 */
export function ReceivePaymentDialog({
  open,
  onOpenChange,
  companyId,
  creditAccountId,
  balance,
  saleId,
  customerId,
  onPaid,
}: Props) {
  const [amountStr, setAmountStr] = useState<string>("");
  const [method, setMethod] = useState<string>("cash");
  const [paidAt, setPaidAt] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState<string>("");

  const mutation = useReceiveCreditPayment({ saleId, customerId });

  useEffect(() => {
    if (open) {
      setAmountStr(balance > 0 ? balance.toFixed(2).replace(".", ",") : "");
      setMethod("cash");
      setPaidAt(new Date().toISOString().slice(0, 10));
      setNotes("");
    }
  }, [open, balance]);

  const amount = useMemo(() => {
    const n = Number(amountStr.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountStr]);

  const exceeds = amount > balance + 0.005;
  const canConfirm = amount > 0 && !exceeds && !mutation.isPending;

  async function handleConfirm() {
    if (!canConfirm) return;
    try {
      const res = await mutation.mutateAsync({
        companyId,
        creditAccountId,
        amount,
        paymentMethod: method,
        // Data de hoje => a RPC registra o instante real da liquidação (now()).
        paidAt:
          paidAt && paidAt !== new Date().toISOString().slice(0, 10)
            ? new Date(paidAt + "T12:00:00").toISOString()
            : undefined,
        notes: notes.trim() || null,
      });
      toast.success(
        res.settled ? "Crediário quitado" : "Recebimento registrado",
        {
          description: res.settled
            ? "A venda foi marcada como paga."
            : `Saldo restante: ${formatCurrency(res.balance)}`,
        },
      );
      onPaid?.({ balance: res.balance, settled: res.settled });
      onOpenChange(false);
    } catch (err) {
      const e = err as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      } | null;
      const parts = [
        e?.message,
        e?.details,
        e?.hint,
        e?.code ? `código ${e.code}` : null,
      ].filter(Boolean);
      // eslint-disable-next-line no-console
      console.error("[receive-payment-dialog] receive_credit_payment failed", err);
      toast.error("Falha ao registrar recebimento", {
        description:
          parts.length > 0
            ? parts.join(" • ")
            : "Erro desconhecido ao registrar recebimento.",
      });
    }

  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Registrar recebimento
          </DialogTitle>
          <DialogDescription>
            Saldo em aberto:{" "}
            <strong className="text-foreground">{formatCurrency(balance)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
              Valor recebido (R$)
            </Label>
            <Input
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="tabular-nums"
              autoFocus
            />
            {exceeds ? (
              <p className="mt-1 text-[11px] text-destructive">
                O valor excede o saldo em aberto ({formatCurrency(balance)}).
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {[0.25, 0.5, 1].map((frac) => {
                  const v = Math.max(0, balance * frac);
                  return (
                    <Button
                      key={frac}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() =>
                        setAmountStr(v.toFixed(2).replace(".", ","))
                      }
                    >
                      {frac === 1
                        ? "Total"
                        : `${Math.round(frac * 100)}% (${formatCurrency(v)})`}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                Forma de pagamento
              </Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREDIT_PAYMENT_METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                Data do recebimento
              </Label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
              Observações
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="min-w-[160px]"
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : null}
            Confirmar recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
