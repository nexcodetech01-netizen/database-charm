import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Antes do teste do Asaas, responder:</h1>
        
        <div className="space-y-4 text-left">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="font-medium">1. Uma venda de teste pode ser excluída?</p>
            <p className="mt-1 text-sm text-muted-foreground">Sim, vendas com status de homologação podem ser removidas para limpeza de base.</p>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <p className="font-medium">2. Se não, qual é o fluxo correto (cancelar ou estornar)?</p>
            <p className="mt-1 text-sm text-muted-foreground">Para vendas reais, o cancelamento é para erros operacionais e o estorno para devoluções financeiras.</p>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <p className="font-medium">3. Ao cancelar, o estoque volta automaticamente?</p>
            <p className="mt-1 text-sm text-muted-foreground">Sim, o motor de inventário reverte a saída automaticamente no cancelamento.</p>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <p className="font-medium">4. Ao cancelar, a cobrança do Asaas é cancelada também?</p>
            <p className="mt-1 text-sm text-muted-foreground">Sim, se a cobrança estiver pendente, o NexOS solicita o cancelamento via API no Asaas.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
