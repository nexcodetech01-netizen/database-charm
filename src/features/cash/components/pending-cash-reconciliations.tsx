import { useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { useResolvePendingCashReconciliation } from "../hooks/use-cash";
import type { CashSession, PendingCashReconciliation } from "../types";

interface Props {
  items: PendingCashReconciliation[];
  openSession: CashSession | null | undefined;
}

export function PendingCashReconciliations({ items, openSession }: Props) {
  const [open, setOpen] = useState(false);
  const resolvePending = useResolvePendingCashReconciliation();

  if (items.length === 0) return null;

  async function handleResolve(item: PendingCashReconciliation) {
    try {
      await resolvePending.mutateAsync(item.id);
      toast.success("Devolução registrada no caixa.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a devolução.");
    }
  }

  return (
    <>
      <Alert className="border-warning/40 bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle>Devoluções pendentes</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>Você tem {items.length} devolução(ões) aguardando registro no caixa.</span>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Ver pendências
          </Button>
        </AlertDescription>
      </Alert>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Devoluções aguardando registro</DialogTitle>
            <DialogDescription>
              {openSession
                ? "Registre cada devolução no caixa aberto atual."
                : "Abra o caixa pra poder registrar essas devoluções."}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  {openSession ? <TableHead className="text-right">Ação</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isCashIn = item.movement_type === "cash_in";
                  const Icon = isCashIn ? ArrowDownToLine : ArrowUpFromLine;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {item.source === "sale" ? "Venda" : "Compra"} {item.reference_number ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-48 text-muted-foreground">
                        {item.reason ?? "Cancelamento"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isCashIn ? "default" : "destructive"} className="gap-1">
                          <Icon className="h-3 w-3" />
                          {isCashIn ? "Suprimento" : "Sangria"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(Number(item.amount))}
                      </TableCell>
                      {openSession ? (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleResolve(item)}
                            disabled={resolvePending.isPending}
                          >
                            Registrar no caixa
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}