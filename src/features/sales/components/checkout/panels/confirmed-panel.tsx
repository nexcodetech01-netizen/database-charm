import { CheckCircle2 } from "lucide-react";

export function ConfirmedPanel() {
  return (
    <div className="flex items-center gap-3 text-emerald-600">
      <CheckCircle2 className="h-6 w-6" />
      <div>
        <div className="text-sm font-semibold">Pagamento confirmado</div>
        <div className="text-xs text-muted-foreground">
          Clique em Concluir venda para imprimir o cupom.
        </div>
      </div>
    </div>
  );
}
