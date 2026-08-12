import { useState, useEffect } from "react";
import { History, ShoppingCart, Trash2, Clock, User } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSuspendedSales, removeSuspendedSale, type SuspendedSale } from "../lib/suspended-sales";

type Props = {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sale: SuspendedSale) => void;
};

export function PDVSuspendedDialog({ companyId, open, onOpenChange, onSelect }: Props) {
  const [sales, setSales] = useState<SuspendedSale[]>([]);

  useEffect(() => {
    if (open) {
      setSales(getSuspendedSales(companyId));
    }
  }, [open, companyId]);

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    removeSuspendedSale(companyId, id);
    setSales(getSuspendedSales(companyId));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <DialogTitle>Vendas Suspensas</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-medium">Nenhuma venda suspensa</p>
              <p className="text-sm">Vendas pausadas aparecerão aqui.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => onSelect(sale)}
                  className="group flex flex-col gap-2 rounded-xl border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">
                        #{sale.number.split("-").pop()}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 h-5">
                        {sale.itemCount} {sale.itemCount === 1 ? "Item" : "Itens"}
                      </Badge>
                    </div>
                    <span className="text-lg font-bold tabular-nums">
                      {formatCurrency(sale.total)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="truncate max-w-[150px]">
                          {sale.customerName || "Consumidor Final"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(sale.timestamp), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDelete(sale.id, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t text-[10px] text-center text-muted-foreground uppercase tracking-widest">
          Clique em uma venda para recuperá-la
        </div>
      </DialogContent>
    </Dialog>
  );
}
