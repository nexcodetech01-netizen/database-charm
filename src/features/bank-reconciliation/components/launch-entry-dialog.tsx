import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { financeService } from "@/features/finance";
import type { StatementEntry } from "../lib/nubank-statement";

export interface AccountLite {
  id: string;
  name: string;
  type: string;
}
export interface CategoryLite {
  id: string;
  name: string;
  kind: string;
}

type Option = {
  value: string;
  label: string;
  type: "income" | "expense" | "transfer";
  prefix?: string;
  categoryHint?: RegExp;
};

const IN_OPTIONS: Option[] = [
  { value: "sale", label: "Venda / recebimento de cliente", type: "income", categoryHint: /venda|receita/i },
  { value: "repasse", label: "Repasse de outra conta (ex.: conta pessoal)", type: "transfer" },
  { value: "aporte", label: "Aporte de sócio", type: "income", prefix: "Aporte de sócio", categoryHint: /aporte|s[oó]cio|capital/i },
  { value: "other_in", label: "Outra entrada", type: "income" },
];
const OUT_OPTIONS: Option[] = [
  { value: "expense", label: "Despesa da loja (frete, taxa, fatura…)", type: "expense" },
  { value: "purchase", label: "Compra de mercadoria", type: "expense", prefix: "Compra de mercadoria", categoryHint: /compra|mercadoria|estoque|fornecedor/i },
  { value: "retirada", label: "Retirada de sócio", type: "expense", prefix: "Retirada de sócio", categoryHint: /retirada|pr[oó]-?labore|s[oó]cio/i },
  { value: "transfer_out", label: "Transferência para outra conta da loja", type: "transfer" },
];

export function LaunchEntryDialog({
  open,
  onOpenChange,
  entry,
  companyId,
  accountId,
  accounts,
  categories,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry: StatementEntry | null;
  companyId: string;
  accountId: string;
  accounts: AccountLite[];
  categories: CategoryLite[];
  onDone: (link: { transaction_id?: string; transfer_id?: string }) => Promise<void> | void;
}) {
  const options = entry?.direction === "in" ? IN_OPTIONS : OUT_OPTIONS;
  const [kind, setKind] = useState(options[0].value);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [otherAccountId, setOtherAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const option = options.find((o) => o.value === kind) ?? options[0];
  const otherAccounts = accounts.filter((a) => a.id !== accountId);
  const typeCategories = useMemo(() => categories.filter((c) => c.kind === option.type), [categories, option.type]);

  useEffect(() => {
    if (!entry) return;
    const first = (entry.direction === "in" ? IN_OPTIONS : OUT_OPTIONS)[0];
    setKind(first.value);
    setDescription(entry.counterparty || entry.kind);
    setCategoryId("");
    setOtherAccountId("");
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    const base = entry.counterparty || entry.kind;
    setDescription(option.prefix ? `${option.prefix} · ${base}` : base);
    const hinted = option.categoryHint ? typeCategories.find((c) => option.categoryHint?.test(c.name)) : undefined;
    setCategoryId(hinted?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  if (!entry) return null;

  async function submit() {
    if (!entry) return;
    setSaving(true);
    try {
      if (option.type === "transfer") {
        if (!otherAccountId) {
          toast.error("Escolha a outra conta.");
          setSaving(false);
          return;
        }
        const isIn = entry.direction === "in";
        const id = await financeService.transferBetweenAccounts({
          companyId,
          fromAccountId: isIn ? otherAccountId : accountId,
          toAccountId: isIn ? accountId : otherAccountId,
          amount: entry.amount,
          date: entry.date,
          description: description || "Transferência (conciliação do extrato)",
        });
        await onDone({ transfer_id: id });
      } else {
        const created = await financeService.createAndSettleTransaction(
          {
            company_id: companyId,
            type: option.type,
            description: description.trim() || entry.kind,
            amount: entry.amount,
            transaction_date: entry.date,
            due_date: entry.date,
            category_id: categoryId || null,
            notes: `Lançado pela conciliação do extrato (${entry.description})`,
          } as never,
          { paymentMethod: "pix", accountId, paidAt: entry.date },
        );
        await onDone({ transaction_id: (created as { id: string }).id });
      }
      toast.success("Lançado.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível lançar.");
    } finally {
      setSaving(false);
    }
  }

  const [y, m, d] = entry.date.split("-");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-6 [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>Lançar movimento do extrato</DialogTitle>
          <DialogDescription>
            {d}/{m}/{y} · {entry.direction === "in" ? "entrada" : "saída"} de{" "}
            <span className="font-semibold text-foreground">{formatCurrency(entry.amount)}</span> · {entry.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>O que é</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {option.type === "transfer" ? (
            <div className="space-y-1">
              <Label>{entry.direction === "in" ? "Veio da conta" : "Foi para a conta"}</Label>
              <Select value={otherAccountId} onValueChange={setOtherAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a conta" />
                </SelectTrigger>
                <SelectContent>
                  {otherAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Não achou a conta? Crie em Financeiro → Contas (ex.: "Conta pessoal (repasse)").
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Categoria (opcional)</Label>
              <Select value={categoryId || "__none"} onValueChange={(v) => setCategoryId(v === "__none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sem categoria</SelectItem>
                  {typeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </div>

          {kind === "purchase" ? (
            <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              Isto registra só o pagamento. Para dar entrada dos produtos no estoque, cadastre a compra em Compras.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
