import { useEffect, useRef } from "react";
import { CheckCircle2, FileText, Plus, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPrintReceipt: () => void;
  onViewSale: () => void;
  /** Fecha diálogos e limpa carrinho/cliente para uma nova venda. */
  onNewSale?: () => void;
  /** Mensagem personalizada de sucesso. */
  title?: string;
  description?: string;
}

/**
 * Diálogo de sucesso pós-conclusão da venda.
 * Reutiliza o ReceiptDialog/SaleReceipt existentes por meio dos callbacks.
 * Não altera qualquer regra de negócio.
 */
export function SaleCompletedDialog({
  open,
  onOpenChange,
  onPrintReceipt,
  onViewSale,
  onNewSale,
  title = "Venda concluída",
  description = "Venda registrada com sucesso.",
}: Props) {
  const printRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => printRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button type="button" ref={printRef} onClick={onPrintReceipt} className="w-full">
            <Printer className="mr-1.5 h-4 w-4" />
            Imprimir cupom
          </Button>
          {onNewSale ? (
            <Button type="button" variant="outline" onClick={onNewSale} className="w-full">
              <Plus className="mr-1.5 h-4 w-4" />
              Nova venda
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onViewSale} className="w-full">
            <FileText className="mr-1.5 h-4 w-4" />
            Ver venda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

