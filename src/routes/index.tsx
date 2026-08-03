import { createFileRoute } from "@tanstack/react-router";
import { SPACING_TOKENS } from "@/design";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/index")({
  component: VerificationPage,
});

function VerificationPage() {
  return (
    <div className={cn("mx-auto w-full max-w-7xl p-6", SPACING_TOKENS.relaxed.stack)}>
      <h1 className="text-2xl font-bold mb-6">VERIFICAÇÃO FINAL — MERCADO LIVRE (READ-ONLY)</h1>
      
      <div className="bg-muted/30 border rounded-lg p-6 space-y-4">
        <p className="font-medium text-destructive">Não pesquisar código.</p>
        <p className="font-medium text-destructive">Consultar apenas o estado atual do banco de dados.</p>
        
        <div className="space-y-4 pt-4">
          <p className="font-bold">Responder:</p>
          
          <ol className="list-decimal list-inside space-y-3">
            <li>Existe um registro da integração do Mercado Livre para esta empresa? (SIM/NÃO)</li>
            <li>O company_id continua o mesmo? (SIM/NÃO)</li>
            <li>O ml_user_id continua o mesmo? (SIM/NÃO)</li>
            <li>O seller_id continua o mesmo? (SIM/NÃO)</li>
            <li>Os anúncios vinculados permanecem associados aos mesmos produtos? (SIM/NÃO)</li>
            <li>Apenas os campos access_token_encrypted e refresh_token_encrypted estão vazios? (SIM/NÃO)</li>
            <li>Existe qualquer evidência de perda de anúncios, produtos ou vínculos? (SIM/NÃO)</li>
          </ol>
          
          <p className="pt-4 italic text-muted-foreground">
            Responder apenas com SIM/NÃO e, se houver algum NÃO, explicar exatamente qual informação está faltando.
          </p>
        </div>
      </div>
    </div>
  );
}
