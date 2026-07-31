import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Props = {
  onFinalize?: () => void;
  isSaving?: boolean;
  disabled?: boolean;
};

/**
 * Painel de finalização do PDV.
 * Grava a venda pelo fluxo existente e abre o CheckoutDialog (motor único
 * de pagamentos do NexOS).
 */
export function PDVPaymentPanel({ onFinalize, isSaving, disabled }: Props = {}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-semibold">Finalização</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Ao finalizar, o checkout do NexOS abre com todas as formas de
        pagamento: dinheiro (com troco), PIX, cartão, crediário, link e boleto.
      </p>
      <Button
        id="pdv-finalize"
        className="mt-3 h-12 w-full text-base"
        onClick={onFinalize}
        disabled={disabled || isSaving || !onFinalize}
      >
        {isSaving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gravando...
          </>
        ) : (
          "Finalizar Venda"
        )}
      </Button>
    </div>
  );
}
