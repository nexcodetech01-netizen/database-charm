import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">AUDITORIA READ-ONLY — FECHAMENTO DE CAIXA</h1>
      <div className="space-y-2 text-muted-foreground">
        <p>Não alterar banco.</p>
        <p>Não alterar código.</p>
        <p>Não fechar caixa automaticamente.</p>
      </div>
      
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Verificar:</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>Quantos caixas estão abertos atualmente.</li>
          <li>Qual o ID do caixa aberto.</li>
          <li>Data e hora de abertura.</li>
          <li>Se existe registro de fechamento ontem.</li>
          <li>Qual usuário realizou o fechamento.</li>
          <li>Se o fechamento foi gravado com sucesso.</li>
          <li>Se existe divergência entre a tabela de caixas e a tela.</li>
        </ol>
      </div>
      
      <p className="mt-8 font-medium">Responder apenas com os resultados da auditoria.</p>
    </div>
  );
}
