import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { PurchaseItemDraft } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PurchaseItemDraft[];
  onConfirm: (items: PurchaseItemDraft[]) => void;
}

export function PurchaseImportReviewDialog({
  open,
  onOpenChange,
  items: initialItems,
  onConfirm,
}: Props) {
  const [items, setItems] = useState<PurchaseItemDraft[]>(initialItems);

  // Sincroniza estado interno quando initialItems mudar (abertura do dialog)
  if (items !== initialItems && open && items.length === 0) {
     setItems(initialItems);
  }

  function updateItem(index: number, patch: Partial<PurchaseItemDraft>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  const grandTotal = items.reduce(
    (sum, it) => sum + (it.quantity * it.unit_price),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <DialogTitle>Revisar Importação</DialogTitle>
          </div>
          <DialogDescription>
            Confira as quantidades e preços extraídos pela IA. Você pode editar
            a descrição se necessário.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto my-4 border rounded-md">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead>Produto / Descrição</TableHead>
                <TableHead className="w-[100px] text-right">Qtd. Real</TableHead>
                <TableHead className="w-[130px] text-right">Custo Unit.</TableHead>
                <TableHead className="w-[130px] text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      value={it.description}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: Number(e.target.value) || 0 })
                      }
                      className="h-8 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={it.unit_price}
                      onChange={(e) =>
                        updateItem(idx, { unit_price: Number(e.target.value) || 0 })
                      }
                      className="h-8 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(it.quantity * it.unit_price)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>Kits e pacotes foram fracionados automaticamente pela IA.</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Extraído</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Descartar
          </Button>
          <Button onClick={() => onConfirm(items)}>
            Confirmar e Preencher Compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
