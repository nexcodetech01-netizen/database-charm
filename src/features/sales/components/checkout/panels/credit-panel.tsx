import { memo } from "react";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

/** Aviso exibido acima dos métodos quando o crediário está sem cliente. */
export const CreditBlockedAlert = memo(function CreditBlockedAlert({
  onSelectCustomer,
}: {
  onSelectCustomer: () => void;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5">
      <div className="flex items-center gap-3 text-destructive mb-2">
        <AlertCircle className="h-6 w-6" />
        <h3 className="font-bold">Crediário Bloqueado</h3>
      </div>
      <p className="text-sm text-destructive font-medium mb-3">
        Para vender no crediário, selecione um cliente cadastrado.
      </p>
      <Button 
        variant="destructive" 
        size="sm" 
        onClick={onSelectCustomer}
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Selecionar Cliente
      </Button>
    </div>
  );
});

interface CreditPanelProps {
  customerId: string | null;
  customerName: string | null;
  amount: number;
}

export const CreditPanel = memo(function CreditPanel({
  customerId,
  customerName,
  amount,
}: CreditPanelProps) {
  return (
    <div className="space-y-4">
      {!customerId ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
          <p className="text-sm font-medium text-destructive">
            Selecione um cliente para habilitar o crediário.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg bg-blue-600/5 p-4 border border-primary/20">
            <p className="text-sm text-gray-100 font-medium mb-1">Fluxo de Crediário</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ao clicar em <strong>Abrir Crediário</strong>, você poderá definir o parcelamento, data de vencimento e registrar entradas parciais.
            </p>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-2 bg-muted/20">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-semibold">{customerName || "Não identificado"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor a parcelar:</span>
              <span className="font-bold text-gray-100">{formatCurrency(amount)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
