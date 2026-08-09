import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
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
import { ACCOUNT_TYPE_OPTIONS, type FinancialAccount } from "../types";
import { useCreateAccount, useUpdateAccount } from "../hooks/use-finance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  account?: FinancialAccount | null;
}

const EMPTY = {
  name: "",
  type: "bank" as const,
  bank: "",
  agency: "",
  account_number: "",
  initial_balance: 0,
  status: "active" as const,
};

export function AccountFormDialog({ open, onOpenChange, companyId, account }: Props) {
  const [form, setForm] = useState({ ...EMPTY });
  const createMut = useCreateAccount();
  const updateMut = useUpdateAccount();
  const isEdit = !!account;

  useEffect(() => {
    if (!open) return;
    if (account) {
      setForm({
        name: account.name,
        type: (account.type as typeof EMPTY.type) ?? "bank",
        bank: account.bank ?? "",
        agency: account.agency ?? "",
        account_number: account.account_number ?? "",
        initial_balance: Number(account.initial_balance ?? 0),
        status: (account.status as typeof EMPTY.status) ?? "active",
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [open, account]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome da conta");
      return;
    }
    try {
      if (isEdit && account) {
        await updateMut.mutateAsync({
          id: account.id,
          input: {
            name: form.name.trim(),
            type: form.type,
            bank: form.bank || null,
            agency: form.agency || null,
            account_number: form.account_number || null,
            initial_balance: form.initial_balance,
            status: form.status,
          },
        });
        toast.success("Conta atualizada");
      } else {
        await createMut.mutateAsync({
          company_id: companyId,
          name: form.name.trim(),
          type: form.type,
          bank: form.bank || null,
          agency: form.agency || null,
          account_number: form.account_number || null,
          initial_balance: form.initial_balance,
          current_balance: form.initial_balance,
          status: form.status,
        });
        toast.success("Conta criada");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta" : "Nova conta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Conta Nubank"
                autoFocus
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as typeof EMPTY.type })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} textValue={o.label}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Banco</Label>
              <Input
                value={form.bank}
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label>Agência</Label>
              <Input
                value={form.agency}
                onChange={(e) => setForm({ ...form, agency: e.target.value })}
              />
            </div>
            <div>
              <Label>Conta</Label>
              <Input
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              />
            </div>
            <div>
              <Label>Saldo inicial</Label>
              <Input
                type="number"
                step="0.01"
                value={form.initial_balance}
                onChange={(e) => setForm({ ...form, initial_balance: Number(e.target.value) })}
                placeholder="Valor para ajuste de saldo"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                O saldo atual será recalculado com base neste valor + movimentações.
              </p>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as typeof EMPTY.status })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active" textValue="Ativa">Ativa</SelectItem>
                  <SelectItem value="archived" textValue="Arquivada">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
