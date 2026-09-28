import { memo } from "react";
import { ArrowLeft, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingPanelProps {
  customerId: string | null;
  onSelectCustomer: () => void;
}

export const PendingPanel = memo(function PendingPanel({
  customerId,
  onSelectCustomer,
}: PendingPanelProps) {
  return (
    <div className="space-y-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5">
      <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-500">
        <Wallet className="h-6 w-6" />
        <h3 className="font-bold">Pagamento Pendente</h3>
      </div>

      {!customerId ? (
        <div className="space-y-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
            Para utilizar esta forma de pagamento é necessário selecionar um cliente.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-yellow-500/50 hover:bg-yellow-500/20"
            onClick={onSelectCustomer}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Selecionar Cliente
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A venda será finalizada com status <span className="font-semibold text-foreground">Pendente</span>.
            O estoque será baixado imediatamente e um título será criado no <span className="font-semibold text-foreground">Contas a Receber</span>.
          </p>
          <div className="rounded-lg bg-background/50 p-3 text-xs border border-yellow-500/20">
            O pagamento poderá ser informado posteriormente na tela de detalhes da venda ou no módulo financeiro.
          </div>
        </>
      )}
    </div>
  );
});
