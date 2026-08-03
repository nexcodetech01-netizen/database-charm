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
        <p className="mb-4">Investigar exclusivamente o card "Recebido hoje" do Dashboard.</p>

        <div className="space-y-3">
          <p className="font-medium">Responder:</p>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Qual consulta SQL ou serviço alimenta esse card?</li>
            <li>Qual campo de data é utilizado (created_at, paid_at, confirmed_at, financial_date, etc.)?</li>
            <li>Qual registro está compondo os R$ 40,00?</li>
            <li>Qual é a data gravada nesse registro?</li>
            <li>O filtro considera o dia do calendário ou as últimas 24 horas?</li>
            <li>Existe divergência entre a regra implementada e o texto "Recebido hoje"?</li>
          </ol>
        </div>
      </div>

      <p className="text-sm font-semibold pt-4">Responder somente no chat.</p>
    </div>
  );
}
