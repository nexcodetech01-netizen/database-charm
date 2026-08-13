# Plano de Implementação: Consignação de Produtos

Implementação da feature de Consignação para permitir a entrega de produtos a revendedores externos com controle de comissão, fechamentos periódicos e geração de contratos em PDF.

## User Review Requerido

> [!IMPORTANT]
> A geração de PDF será implementada inicialmente como um placeholder, pois bibliotecas de PDF nativas em Cloudflare Workers (Edge) requerem integrações específicas ou serviços externos. Confirmaremos a melhor abordagem para o ambiente de produção.

- O fluxo de comissão suportará tanto percentual quanto valor fixo.
- O controle de estoque será via snapshot de custo no momento do envio.

## Detalhes Técnicos

### 1. Schema Database (Supabase)
- **public.resellers**: Cadastro de revendedores (nome, documento, contato).
- **public.consignments**: Cabeçalho da consignação (status, comissão, data).
- **public.consignment_items**: Itens enviados, vendidos e devolvidos.
- **public.consignment_settlements**: Registros de fechamentos financeiros.
- RLS habilitado em todas as tabelas com filtro por `company_id`.

### 2. Frontend & Navegação
- Adição de rotas `/_authenticated/consignacoes` e `/_authenticated/revendedores`.
- Integração no `AppSidebar` sob o grupo "Operacional".
- Componentes de UI utilizando Radix UI e Tailwind (Design System NexOS).

### 3. Lógica de Negócio
- `ConsignmentService`: Centraliza operações CRUD e cálculos de fechamento.
- Validação de integridade: `vendidos + devolvidos <= enviados`.
- `generateConsignmentPDF`: Função de servidor para orquestrar a geração do documento.

### 4. Cronograma de Arquivos
- `src/features/consignment/types/index.ts` (Concluído)
- `src/features/consignment/services/consignment.service.ts` (Concluído/Ajustado)
- `src/routes/_authenticated/consignacoes.tsx` (Estrutura Inicial)
- `src/routes/_authenticated/revendedores.tsx` (Estrutura Inicial)
- `src/features/consignment/lib/pdf.functions.ts` (Implementado)
