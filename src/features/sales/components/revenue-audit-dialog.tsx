import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SALE_STATUS_OPTIONS } from "../types";


interface RevenueAuditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown: Array<{
    status: string;
    count: number;
    total: number;
  }>;
  dayTotal: number;
}

export function RevenueAuditDialog({
  isOpen,
  onOpenChange,
  breakdown,
  dayTotal,
}: RevenueAuditDialogProps) {
  const getStatusLabel = (status: string) => {
    return (
      SALE_STATUS_OPTIONS.find((opt: { value: string; label: string }) => opt.value === status)?.label || status
    );
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-info" />
            <DialogTitle>Auditoria de Receita</DialogTitle>
          </div>
          <DialogDescription>
            Decomposição do faturamento bruto por status de venda para o dia de hoje.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Nenhuma venda registrada no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  breakdown.map((item) => (
                    <TableRow key={item.status}>
                      <TableCell className="font-medium">
                        {getStatusLabel(item.status)}
                      </TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {breakdown.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total Bruto</TableCell>
                    <TableCell className="text-right">
                      {breakdown.reduce((s, i) => s + i.count, 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(dayTotal)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg bg-info/10 p-4 text-xs text-info-foreground leading-relaxed">
            <p className="font-semibold mb-1">Nota Técnica:</p>
            A 'Receita do Período' reflete o <b>Faturamento Bruto</b> (valor total das vendas emitidas), 
            independente de estarem pagas. Vendas canceladas são excluídas do cálculo conforme política fiscal.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
