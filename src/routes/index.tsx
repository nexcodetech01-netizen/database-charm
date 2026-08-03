import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold uppercase tracking-tight">INVESTIGAÇÃO READ-ONLY</h1>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Não alterar código.</p>
        <p>Não alterar banco.</p>
        <p>Não alterar interface.</p>
      </div>

      <div className="bg-muted/50 p-6 rounded-lg border">
        <p className="mb-4">Investigar exclusivamente o registro financeiro:</p>
        <p className="font-mono text-xs mb-4">ID: 3df98503-993f-4994-899d-03805a12eaa1</p>

        <div className="space-y-3">
          <p className="font-medium">Responder:</p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>transaction_date</li>
            <li>created_at</li>
            <li>paid_at</li>
            <li>timezone armazenado</li>
            <li>Quem definiu o paid_at (Asaas, venda manual, trigger ou backend?)</li>
            <li>Confirmar se paid_at = 2026-08-04 01:23 UTC está correto ou se existe erro de data.</li>
          </ol>
        </div>
      </div>

      <p className="text-sm font-semibold pt-4">Responder somente no chat.</p>
    </div>
  );
}
