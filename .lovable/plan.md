# Plano de Implementação: Recuperação de Entrada Não Paga

Implementar o fluxo de follow-up automático via WhatsApp para cobranças de "entrada" geradas no catálogo público que permanecem pendentes.

## Alterações Propostas

### 1. Banco de Dados (Migrations)
- **Migration 1**: Adicionar colunas `buyer_name`, `buyer_phone` e `followup_sent_at` na tabela `bella_pay_charges`. Criar índice para performance do job.
- **Migration 2**: Agendar o job `entrada-followup` via `pg_cron` para rodar a cada 30 minutos.

### 2. Backend (API Routes)
- **Substituir `src/routes/api/public/catalog/entrada.ts`**: Atualizar a rota para salvar o nome e telefone do comprador de forma estruturada no banco de dados.
- **Criar `src/routes/api/public/jobs/entrada-followup.ts`**: Implementar o job que busca cobranças pendentes há mais de 3 horas e envia o lembrete via WhatsApp usando o template `cobranca_criada_v2`.

## Detalhes Técnicos
- O job utiliza o template aprovado pela Meta para garantir a entrega fora da janela de 24h.
- A autenticação do job segue o padrão `CRON_JOB_SECRET`.
- Proteção contra duplicidade via coluna `followup_sent_at`.

## Passos de Verificação
1. Validar a aplicação das migrations.
2. Testar a criação de cobrança no catálogo e verificar se os novos campos são preenchidos.
3. Simular o job (ajustando o delay temporal) e confirmar o envio da mensagem de follow-up.
