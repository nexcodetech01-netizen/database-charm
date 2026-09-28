import { memo } from "react";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { UiCheckoutMethod } from "./types";

const CONFIRM_LABEL: Partial<Record<UiCheckoutMethod, string>> = {
  pix_manual: "Confirmar Pagamento (Pix)",
  cash: "Confirmar Recebimento (Dinheiro)",
  debit_card: "Confirmar Débito",
  credit: "Avançar para Crediário (F5)",
  pending_payment: "Criar Venda Pendente",
};

interface CheckoutFooterProps {
  method: UiCheckoutMethod;
  confirmed: boolean;
  customerId: string | null;
  /** Exibe "Voltar" (volta a editar os itens). */
  canGoBack: boolean;
  /** Alguma ação de finalização em andamento. */
  busy: boolean;
  /** Bloqueia o "Fechar" enquanto o status da venda está sendo gravado. */
  closeDisabled: boolean;
  confirmDisabled: boolean;
  onBack: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const CheckoutFooter = memo(function CheckoutFooter({
  method,
  confirmed,
  customerId,
  canGoBack,
  busy,
  closeDisabled,
  confirmDisabled,
  onBack,
  onClose,
  onConfirm,
}: CheckoutFooterProps) {
  const label = confirmed ? "Concluído" : (CONFIRM_LABEL[method] ?? "Confirmar Pagamento (F5)");

  return (
    <DialogFooter className="sticky bottom-0 z-10 shrink-0 border-t bg-background px-5 py-3 sm:flex-row gap-2">
      <div className="flex w-full gap-2">
        {canGoBack && !confirmed ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onBack}
            title="Fecha o pagamento e volta para editar os itens desta venda"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          onClick={onClose}
          disabled={closeDisabled}
        >
          <XCircle className="mr-1.5 h-4 w-4" /> Fechar
        </Button>
        <Button
          type="button"
          className={cn(
            "flex-[2] min-w-[180px]",
            method === "credit" &&
              !confirmed &&
              customerId &&
              "bg-blue-600 hover:bg-blue-600/90 text-gray-100-foreground font-bold shadow-md",
          )}
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
          )}
          {label}
        </Button>
      </div>
    </DialogFooter>
  );
});
