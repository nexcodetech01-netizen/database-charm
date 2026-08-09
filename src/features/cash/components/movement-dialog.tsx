import { useState } from "react";
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
import { useRegisterCashMovement, useCashSummary } from "../hooks/use-cash";
import type { CashMovementType } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  type: CashMovementType;
  sessionId: string;
  companyId: string;
  createdBy: string | null;
}

export function MovementDialog({
  open,
  onOpenChange,
  type,
  sessionId,
  companyId,
  createdBy,
}: Props) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const { data: summary } = useCashSummary({ id: sessionId } as any);
  const { mutateAsync, isPending } = useRegisterCashMovement();

  const label = type === "cash_in" ? "Suprimento" : "Sangria";

  async function submit() {
    const value = Number(amount.replace(",", "."));
    if (Number.isNaN(value) || value <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Informe o motivo.");
      return;
    }
    try {
      await mutateAsync({
        sessionId,
        companyId,
        createdBy,
        type,
        amount: value,
        reason,
        note,
      });
      toast.success(`${label} registrado(a).`);
      setAmount("");
      setReason("");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao registrar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {type === "cash_in"
              ? "Registrar entrada manual de dinheiro no caixa."
              : "Registrar retirada de dinheiro do caixa."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="mov-amount">Valor (R$)</Label>
            <Input
              id="mov-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label htmlFor="mov-reason">Motivo</Label>
            <Input
              id="mov-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={type === "cash_in" ? "Troco, reforço…" : "Pagamento, retirada…"}
            />
          </div>
          <div>
            <Label htmlFor="mov-note">Observação</Label>
            <Textarea
              id="mov-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Salvando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
