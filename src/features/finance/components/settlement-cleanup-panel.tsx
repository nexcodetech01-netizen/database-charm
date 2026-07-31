import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useAccounts,
  useCompleteSettlement,
  useIncompleteSettlements,
} from "../hooks/use-finance";
import {
  FINANCE_PAYMENT_METHOD_OPTIONS,
  type FinancePaymentMethod,
  type IncompleteSettlement,
} from "../types";

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

interface Props {
  companyId: string;
}

export function SettlementCleanupPanel({ companyId }: Props) {
  const { data: rows, isLoading } = useIncompleteSettlements(companyId);
  const { data: accounts } = useAccounts(companyId);
  const completeMut = useCompleteSettlement();

  const [target, setTarget] = useState<IncompleteSettlement | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentMethod | "">("");
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");

  const activeAccounts = (accounts ?? []).filter((a) => a.status === "active");
  const list = rows ?? [];

  function openDialog(row: IncompleteSettlement) {
    setTarget(row);
    setPaymentMethod((row.payment_method as FinancePaymentMethod) ?? "");
    setAccountId(row.account_id ?? "");
    setNotes("");
  }

  async function handleConfirm() {
    if (!target) return;
    if (!paymentMethod) {
      toast.error("Selecione a forma de recebimento.");
      return;
    }
    if (!accountId) {
      toast.error("Selecione a conta de destino.");
      return;
    }
    try {
      await completeMut.mutateAsync({
        id: target.id,
        input: { paymentMethod, accountId, notes },
      });
      toast.success("Baixa regularizada");
      setTarget(null);
    } catch (err) {
      toast.error("Não foi possível regularizar a baixa", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saneamento de baixas</CardTitle>
        <CardDescription>
          Baixas antigas que ficaram sem forma de recebimento e/ou conta de destino.
          Ao confirmar, a conta é lançada e — se for Caixa — a movimentação de caixa é
          criada (exige caixa aberto). Lançamentos já corretos não aparecem aqui.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma baixa pendente de regularização.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venda</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Data da baixa</TableHead>
                <TableHead>Pendência</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.sale_number ?? "—"}</TableCell>
                  <TableCell>{row.customer_name ?? "—"}</TableCell>
                  <TableCell className="max-w-[280px] truncate">{row.description}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                  <TableCell>{formatDate(row.paid_at ?? row.transaction_date)}</TableCell>
                  <TableCell className="space-x-1">
                    {!row.payment_method ? (
                      <Badge variant="outline">Sem forma</Badge>
                    ) : null}
                    {!row.account_id ? <Badge variant="outline">Sem conta</Badge> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openDialog(row)}>
                      Complementar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complementar baixa</DialogTitle>
            <DialogDescription>
              {target
                ? `${target.sale_number ? `${target.sale_number} · ` : ""}${target.description} · ${formatCurrency(target.amount)}`
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                Forma de recebimento <span className="text-destructive">*</span>
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as FinancePaymentMethod)}
                disabled={!!target?.payment_method}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {FINANCE_PAYMENT_METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Conta de destino <span className="text-destructive">*</span>
              </Label>
              <Select
                value={accountId}
                onValueChange={setAccountId}
                disabled={!!target?.account_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {target?.account_id ? (
                <p className="text-xs text-muted-foreground">
                  Conta já lançada ({target.account_name ?? "—"}); o saldo não será
                  contabilizado novamente.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={completeMut.isPending}>
              {completeMut.isPending ? "Regularizando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
