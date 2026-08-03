import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout";
import { ShieldAlert } from "lucide-react";
import { Panel, Section } from "@/components/design";

export const Route = createFileRoute("/")({
  component: AuditoriaReadOnlyPage,
});

function AuditoriaReadOnlyPage() {
  return (
    <PageLayout
      icon={ShieldAlert}
      title="AUDITORIA READ-ONLY"
      description="NÃO alterar código. NÃO alterar banco. NÃO alterar interface. NÃO criar arquivos. NÃO modificar textos."
    >
      <div className="max-w-4xl space-y-8">
        <Section title="Objetivo">
          <p className="text-sm text-muted-foreground">
            Auditar exclusivamente o fluxo de vendas com pagamento pendente.
          </p>
        </Section>

        <Section title="Verificar e responder SOMENTE NO CHAT">
          <Panel className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">1. Hoje o sistema permite criar uma venda sem definir a forma de pagamento? (SIM/NÃO)</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold">2. Existe um status específico para:</p>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  <li>Pagamento Pendente</li>
                  <li>Pago</li>
                  <li>Cancelado</li>
                </ul>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold">3. Como o financeiro trata uma venda sem pagamento?</p>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  <li>cria conta a receber?</li>
                  <li>cria lançamento financeiro?</li>
                  <li>não cria nada?</li>
                </ul>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold">4. O estoque é baixado no momento da venda ou somente após o pagamento?</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold">5. O Dashboard contabiliza essa venda antes do pagamento?</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold">6. O Caixa considera essa venda antes do pagamento?</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold">7. É possível alterar posteriormente a forma de pagamento?</p>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  <li>PIX</li>
                  <li>Dinheiro</li>
                  <li>Cartão</li>
                  <li>Asaas</li>
                </ul>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold">8. Ao informar o pagamento depois, quais processos acontecem automaticamente?</p>
                <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                  <li>baixa financeira</li>
                  <li>atualização do Dashboard</li>
                  <li>atualização do Caixa</li>
                  <li>atualização do status da venda</li>
                </ul>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold">9. Existe alguma inconsistência nesse fluxo?</p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold">10. Qual seria a menor alteração necessária para suportar corretamente vendas entregues com pagamento posterior?</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Responder apenas com o diagnóstico. Se houver sugestões de melhoria, NÃO implementar. Apenas listar no final do relatório.
              </p>
            </div>
          </Panel>
        </Section>
      </div>
    </PageLayout>
  );
}
