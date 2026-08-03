import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/")({
  component: AuditoriaReadOnlyPage,
});

function AuditoriaReadOnlyPage() {
  return (
    <div className="p-8 font-mono text-sm leading-relaxed whitespace-pre-wrap">
SPRINT

Pode alterar código.

OBJETIVO

Eliminar o "limbo" entre venda entregue e pagamento recebido.

ESCOPO

Quando uma venda for finalizada sem pagamento imediato:

- Criar automaticamente um título em Contas a Receber.
- Status inicial: Pagamento Pendente.
- Valor igual ao total da venda.
- Vincular ao cliente.
- Vincular à venda.

Ao receber o pagamento posteriormente:

- Permitir escolher a forma de pagamento:
  - PIX
  - Dinheiro
  - Cartão
  - Asaas
  - Transferência

Após confirmar o recebimento:

- Baixar automaticamente o Contas a Receber.
- Alterar o status da venda para Pago.
- Gerar a movimentação financeira.
- Atualizar o Dashboard.
- Atualizar o Caixa.
- Registrar a data e hora da liquidação.

IMPORTANTE

Não alterar:

- Motor Comercial V2.
- Mercado Livre.
- Asaas.
- Estoque.
- Compras.
- Precificação.
- Caixa (exceto receber a movimentação já existente).
- Fluxo de vendas já pagas.

As vendas pagas no ato devem continuar funcionando exatamente como hoje.

Apenas vendas sem pagamento imediato devem gerar automaticamente um Contas a Receber pendente.

Ao finalizar informar:

1. Arquivos alterados.
2. Migrações criadas (se houver).
3. Testes executados.
4. Confirmação de que nenhuma outra funcionalidade foi alterada.
    </div>
  );
}
