import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">AUDITORIA FUNCIONAL ASAAS (READ-ONLY)</h1>
        
        <div className="space-y-4 text-left">
          <p className="text-sm font-medium">Configuração: <span className="text-destructive font-bold">PIX PRÓPRIO (Não Asaas)</span></p>

          <div className="space-y-2">
            <p className="font-semibold">Validar apenas:</p>
            <ul className="list-decimal space-y-1 pl-5 text-sm">
              <li>Cartão via Asaas (Sandbox/Prod).</li>
              <li>Parcelamento até 3x (Cálculo de taxas).</li>
              <li>Recebimento do webhook de Cartão.</li>
              <li>Atualização automática da venda.</li>
              <li>Atualização do estoque.</li>
              <li>Atualização do financeiro.</li>
            </ul>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="font-semibold italic text-xs">Nota: O Pix deve ser tratado como PIX PRÓPRIO da empresa e não deve fazer parte da validação do Asaas.</p>
            <div className="mt-2 flex gap-4 text-lg">
              <span>✅ OK</span>
              <span>⚠️ Atenção</span>
              <span>❌ Falha</span>
            </div>
          </div>
        </div>
      </div>
    </div>
}
