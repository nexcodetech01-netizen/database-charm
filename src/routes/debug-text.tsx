import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/debug-text")({
  component: () => (
    <div className="p-10 space-y-4">
      <h1 className="text-xl font-bold">Solicitação de Edição de Texto</h1>
      <div className="p-4 border rounded bg-muted/50 whitespace-pre-wrap">
        Responda apenas SIM ou NÃO.

1. A integração (company_id, seller_id e ml_user_id) foi preservada?
2. Apenas os tokens OAuth foram removidos?
3. A reconexão irá somente gerar novos access_token e refresh_token?
4. Nenhum anúncio será perdido?
5. Nenhum produto será perdido?
6. Nenhum vínculo entre produto e anúncio será perdido?
      </div>
      <p className="text-sm text-muted-foreground">
        Nota: O texto acima foi solicitado para edição, mas não foi encontrado no código fonte. 
        Pode ser uma mensagem dinâmica da Bella AI ou conteúdo de banco de dados.
      </p>
      <Link to="/" className="text-primary hover:underline">Voltar</Link>
    </div>
  )
});
