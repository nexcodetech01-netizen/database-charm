import { useState } from "react";
import { Plus, Pencil, Trash2, Landmark, Wallet, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { useAccounts, useDeleteAccount } from "../hooks/use-finance";
import { AccountFormDialog } from "./account-form-dialog";
import type { FinancialAccount } from "../types";

const ICONS: Record<string, typeof Landmark> = {
  bank: Landmark,
  cash: Wallet,
  digital_wallet: Smartphone,
};

const LABELS: Record<string, string> = {
  bank: "Banco",
  cash: "Caixa",
  digital_wallet: "Carteira",
};

export function AccountsPanel({ companyId }: { companyId: string }) {
  const { data, isLoading } = useAccounts(companyId);
  const deleteMut = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialAccount | null>(null);

  function handleNew() {
    setEditing(null);
    setOpen(true);
  }
  function handleEdit(a: FinancialAccount) {
    setEditing(a);
    setOpen(true);
  }
  async function handleDelete(a: FinancialAccount) {
    if (!confirm(`Excluir a conta "${a.name}"?`)) return;
    try {
      await deleteMut.mutateAsync(a.id);
      toast.success("Conta excluída");
    } catch (err) {
      toast.error("Não foi possível excluir", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Contas financeiras</h2>
          <p className="text-sm text-muted-foreground">
            Contas bancárias, caixa e carteiras digitais.
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova conta
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Wallet className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nenhuma conta cadastrada</p>
          <p className="text-sm text-muted-foreground">
            Cadastre a primeira conta para começar a movimentar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((a) => {
            const Icon = ICONS[a.type] ?? Landmark;
            return (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {LABELS[a.type] ?? a.type}
                        {a.bank ? ` · ${a.bank}` : ""}
                      </p>
                    </div>
                  </div>
                  {a.status === "archived" ? (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      Arquivada
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Saldo atual</p>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">
                    {formatCurrency(Number(a.current_balance ?? 0))}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(a)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(a)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AccountFormDialog
        open={open}
        onOpenChange={setOpen}
        companyId={companyId}
        account={editing}
      />
    </div>
  );
}
