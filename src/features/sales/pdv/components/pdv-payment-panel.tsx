import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, XCircle } from "lucide-react";

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
 * de pagamentos do NexOS). Sprint 2.9: botões padronizados e destacados.
 */
export function PDVPaymentPanel({
  onFinalize,
  isSaving,
  disabled,
  onCancelSale,
  cancelDisabled,
}: Props = {}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold">Finalização</p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Ao finalizar, o checkout do NexOS abre com todas as formas de
        pagamento: dinheiro (com troco), PIX, cartão, crediário, link e boleto.
      </p>
      <Button
        id="pdv-finalize"
        className="mt-3 h-12 w-full text-base font-semibold"
        onClick={onFinalize}
        disabled={disabled || isSaving || !onFinalize}
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gravando...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Finalizar Venda (F5)
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="mt-2 h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onCancelSale}
        disabled={cancelDisabled || !onCancelSale}
      >
        <XCircle className="mr-2 h-4 w-4" />
        Cancelar Venda
      </Button>
    </div>
  );
}
