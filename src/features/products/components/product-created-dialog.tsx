import { CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
  productId: string;
  productName: string;
  /** Fecha o modal e prepara um novo cadastro em branco. */
  onCreateAnother: () => void;
}

export function ProductCreatedDialog({
  open,
  onOpenChange,
  productId,
  productName,
  onCreateAnother,
}: Props) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </div>
          <DialogTitle className="text-center">
            Produto cadastrado com sucesso
          </DialogTitle>
          {productName ? (
            <p className="text-center text-sm font-medium text-foreground">
              {productName}
            </p>
          ) : null}
          <DialogDescription className="text-center">
            A Bella calculou automaticamente o preço e preparou este produto para venda.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button asChild autoFocus onClick={close}>
            <Link
              to="/vendas/novo"
              search={{ productId } as Record<string, unknown>}
            >
              Vender este produto
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onCreateAnother();
              close();
            }}
          >
            Cadastrar outro produto
          </Button>
        </div>

        <div className="flex items-center justify-center gap-3 pt-1 text-sm">
          <Button asChild variant="link" className="h-auto p-0" onClick={close}>
            <Link to="/produtos/$productId" params={{ productId }}>
              Ver detalhes
            </Link>
          </Button>
          <span className="text-muted-foreground/50" aria-hidden>
            |
          </span>
          <button
            type="button"
            onClick={close}
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
