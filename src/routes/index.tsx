import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">AUDITORIA FUNCIONAL ASAAS (READ-ONLY)</h1>
        
        <div className="space-y-4 text-left">
          <p className="text-sm font-medium text-destructive">Não alterar nenhuma tela.</p>
          <p className="text-sm font-medium text-destructive">Não adicionar textos, cards ou instruções.</p>

          <div className="space-y-2">
            <p className="font-semibold">Verificar apenas:</p>
            <ul className="list-decimal space-y-1 pl-5 text-sm">
              <li>Integração Asaas conectada.</li>
              <li>Criação de cobrança PIX.</li>
              <li>Criação de cobrança Cartão.</li>
              <li>Parcelamento até 3x.</li>
              <li>Recebimento do webhook.</li>
              <li>Atualização automática da venda.</li>
              <li>Atualização do financeiro.</li>
              <li>Atualização do estoque.</li>
            </ul>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="font-semibold">Responder com:</p>
            <div className="mt-2 flex gap-4 text-lg">
              <span>✅ OK</span>
              <span>⚠️ Atenção</span>
              <span>❌ Falha</span>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground italic">Sem modificar o sistema.</p>
        </div>
      </div>
    </div>
  );
}
