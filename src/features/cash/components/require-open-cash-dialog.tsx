import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

interface Props {
  open: boolean;
  accountName?: string | null;
  onCancel: () => void;
  onOpenCash: () => void;
}

/**
 * UX-CAIXA-001 — Aviso amigável quando a operação exige uma sessão de caixa
 * aberta. Somente navegação/UX: nenhuma regra financeira aqui.
 */
export function RequireOpenCashDialog({ open, accountName, onCancel, onOpenCash }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Não existe um caixa aberto para esta conta.
          </DialogTitle>
          <DialogDescription>
            {accountName
              ? `A conta “${accountName}” exige uma sessão de caixa aberta para registrar esta operação.`
              : "Abra o caixa para continuar. Ao abrir, a operação será retomada automaticamente."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onOpenCash}>Abrir Caixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
