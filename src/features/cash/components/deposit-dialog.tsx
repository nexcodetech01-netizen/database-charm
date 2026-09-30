import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { parseCurrency } from "@/lib/masks";
import { useAccounts } from "@/features/finance/hooks/use-finance";
import { financeService } from "@/features/finance/services/finance.service";
import { cashKeys, useCashSummary } from "../hooks/use-cash";
import type { CashSession } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: CashSession;
  companyId: string;
}

/**
 * "Depositar no banco": tira o dinheiro da gaveta (sangria na sessão) e
 * transfere o valor da conta Caixa para a conta bancária no Financeiro —
 * tudo numa operação só (RPC transfer_between_accounts).
 */
export function DepositDialog({ open, onOpenChange, session, companyId }: Props) {
  const qc = useQueryClient();
  const { data: summary } = useCashSummary(session);
  const { data: accounts } = useAccounts(companyId);
  const [amount, setAmount] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const active = useMemo(
    () => (accounts ?? []).filter((a: any) => a.status === "active"),
    [accounts],
  );
  const cashAccount = active.find((a: any) => a.type === "cash");
  const destinations = active.filter((a: any) => a.type !== "cash");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    const bank = destinations.find((a: any) => a.type === "bank") ?? destinations[0];
    setToAccountId(bank?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const availableInDrawer = summary?.expectedCash ?? null;

  async function submit() {
    const value = parseCurrency(amount);
    if (!(value > 0)) {
      toast.error("Informe o valor do depósito.");
      return;
    }
    if (availableInDrawer != null && value > availableInDrawer) {
      toast.error(
        `O valor é maior que o dinheiro na gaveta (${formatCurrency(availableInDrawer)}).`,
      );
      return;
    }
    if (!cashAccount) {
      toast.error("Nenhuma conta do tipo Caixa encontrada no Financeiro.");
      return;
    }
    if (!toAccountId) {
      toast.error("Escolha a conta que vai receber o depósito.");
      return;
    }

    setSaving(true);
    try {
      const destination = destinations.find((a: any) => a.id === toAccountId);
      await financeService.transferBetweenAccounts({
        companyId,
        fromAccountId: cashAccount.id,
        toAccountId,
        amount: value,
        description: `Depósito do caixa em ${destination?.name ?? "banco"}`,
        cashSessionId: session.id,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: cashKeys.all }),
        qc.invalidateQueries({ queryKey: ["finance"] }),
      ]);
      toast.success("Depósito registrado", {
        description: `${formatCurrency(value)} saiu da gaveta e entrou em ${destination?.name ?? "banco"}.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível registrar o depósito", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Depositar no banco</DialogTitle>
          <DialogDescription>
            Tira o dinheiro da gaveta e coloca na conta bancária, no caixa e no Financeiro.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="deposit-amount">Valor (R$)</Label>
            <Input
              id="deposit-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
            {availableInDrawer != null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Na gaveta agora: {formatCurrency(availableInDrawer)}
              </p>
            ) : null}
          </div>
          <div>
            <Label>Depositar em</Label>
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a conta" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Registrando…" : "Depositar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
