import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { BRLCurrencyInput } from "@/components/ui/brl-currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { useAccounts } from "@/features/finance/hooks/use-finance";
import { financeKeys } from "@/features/finance/hooks/use-finance";
import { useAuth } from "@/providers/auth-provider";
import { emitProlaboreWithdrawal } from "../payroll/actions";
import type { FinancialAdvice } from "../advisor";

interface Props {
  companyId: string;
  advice: FinancialAdvice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

/**
 * Confirmação explícita, do usuário, pra registrar a retirada de
 * pró-labore de verdade — a Bella Contadora não dispara isso sozinha
 * via chat (o registro de skills dela é intencionalmente só leitura,
 * ver payroll/skills/payroll-skills.ts). Esse diálogo é o único caminho
 * para a ação de fato acontecer.
 */
export function ProlaboreWithdrawalDialog({ companyId, advice, open, onOpenChange, onCompleted }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: accounts } = useAccounts(companyId);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const safeAmount = advice?.withdrawal.safeAmount ?? 0;

  useEffect(() => {
    if (open) setAmount(safeAmount);
  }, [open, safeAmount]);

  useEffect(() => {
    if (!accountId && accounts && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const exceeds = amount > safeAmount;

  async function handleConfirm() {
    if (!accountId) {
      toast.error("Selecione a conta de onde vai sair o valor.");
      return;
    }
    if (amount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await emitProlaboreWithdrawal({
        companyId,
        accountId,
        amount,
        createdBy: user?.id ?? null,
      });
      if (result.ok) {
        toast.success(result.message);
        qc.invalidateQueries({ queryKey: financeKeys.all });
        qc.invalidateQueries({ queryKey: ["cash"] });
        onOpenChange(false);
        onCompleted?.();
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error("Não foi possível registrar a retirada.", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar retirada de pró-labore</DialogTitle>
          <DialogDescription>
            Isso cria uma saída financeira já paga, na conta escolhida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            Retirada segura recomendada: <strong>{formatCurrency(safeAmount)}</strong>
            <p className="text-xs text-muted-foreground mt-1">
              Já considera a reserva mínima para operação (compras, contas a pagar, impostos).
            </p>
          </div>

          <div className="space-y-2">
            <Label>Valor da retirada</Label>
            <BRLCurrencyInput value={amount} onValueChange={setAmount} />
            {exceeds && (
              <p className="text-xs text-destructive">
                Isso ultrapassa o teto seguro em {formatCurrency(amount - safeAmount)}.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Conta de origem</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {(accounts ?? []).map((acc: any) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !accountId}>
            {submitting ? "Registrando..." : "Confirmar retirada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
