import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/")({
  component: AuditoriaReadOnlyPage,
});

function AuditoriaReadOnlyPage() {
  return (
    <div className="p-8 font-mono text-sm leading-relaxed whitespace-pre-wrap">
      AUDITORIA READ-ONLY

      NÃO alterar código.
      NÃO alterar banco.
      NÃO alterar interface.
      NÃO criar arquivos.
      NÃO modificar textos.

      Objetivo:

      Auditar exclusivamente o fluxo de vendas com pagamento pendente.

      Verificar e responder SOMENTE NO CHAT:

      1. Hoje o sistema permite criar uma venda sem definir a forma de pagamento? (SIM/NÃO)

      2. Existe um status específico para:
         - Pagamento Pendente
         - Pago
         - Cancelado

      3. Como o financeiro trata uma venda sem pagamento?
         - cria conta a receber?
         - cria lançamento financeiro?
         - não cria nada?

      4. O estoque é baixado no momento da venda ou somente após o pagamento?

      5. O Dashboard contabiliza essa venda antes do pagamento?

      6. O Caixa considera essa venda antes do pagamento?

      7. É possível alterar posteriormente a forma de pagamento?
         - PIX
         - Dinheiro
         - Cartão
         - Asaas

      8. Ao informar o pagamento depois, quais processos acontecem automaticamente?
         - baixa financeira
         - atualização do Dashboard
         - atualização do Caixa
         - atualização do status da venda

      9. Existe alguma inconsistência nesse fluxo?

      10. Qual seria a menor alteração necessária para suportar corretamente vendas entregues com pagamento posterior?

      Responder apenas com o diagnóstico.

      Se houver sugestões de melhoria, NÃO implementar.
      Apenas listar no final do relatório.
    </div>
  );
}
