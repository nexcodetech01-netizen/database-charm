import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold uppercase tracking-tight">Investigação READ-ONLY</h1>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>• Não alterar código.</p>
        <p>• Não alterar banco.</p>
        <p>• Não alterar interface.</p>
      </div>

      <div className="bg-muted/50 p-6 rounded-lg border">
        <h2 className="font-semibold text-lg mb-4">Investigar somente o caixa:</h2>
        <code className="block bg-background p-2 rounded border text-xs mb-6">ID: 7b6c1153-f6d1-4d0d-a719-ee1ba1fc7a07</code>

        <div className="space-y-3">
          <p className="font-medium">Responder:</p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Existe tentativa de fechamento registrada (logs, auditoria ou eventos)?</li>
            <li>O botão "Fechar Caixa" foi acionado?</li>
            <li>Houve erro durante o fechamento?</li>
            <li>Existe exceção registrada?</li>
            <li>O caixa ficou aberto porque a operação falhou ou porque nunca foi concluída?</li>
          </ol>
        </div>
      </div>

      <p className="text-sm font-semibold pt-4">Responder apenas no chat, com evidências.</p>
    </div>
  );
}
