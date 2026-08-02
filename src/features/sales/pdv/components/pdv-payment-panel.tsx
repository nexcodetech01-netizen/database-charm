import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";

type Props = {
  onFinalize?: () => void;
  isSaving?: boolean;
  disabled?: boolean;
  /** Cancela a venda em andamento (limpa o carrinho). Ação já existente. */
  onCancelSale?: () => void;
  cancelDisabled?: boolean;
};

/**
 * Painel de finalização do PDV.
 * Grava a venda pelo fluxo existente e abre o CheckoutDialog (motor único
 * de pagamentos do NexOS). Sprint 3.1: uma única ação em destaque.
 */
export function PDVPaymentPanel({
  onFinalize,
  isSaving,
  disabled,
  onCancelSale,
  cancelDisabled,
}: Props = {}) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <Button
        id="pdv-finalize"
        className="h-12 w-full text-base font-semibold"
        onClick={onFinalize}
        disabled={disabled || isSaving || !onFinalize}
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
            Processando venda...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-5 w-5" aria-hidden="true" />
            Finalizar Venda (F5)
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="mt-1.5 h-8 w-full text-xs text-muted-foreground hover:text-destructive"
        onClick={onCancelSale}
        disabled={cancelDisabled || !onCancelSale}
      >
        Cancelar venda
      </Button>
    </div>
  );
}
