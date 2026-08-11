---
title: Implementação de Kits e Produtos Compostos
description: Adicionar suporte a produtos do tipo kit, com composição dinâmica, cálculo automático de custo e estoque, e baixa automática em cascata.
type: feature
---

## 1. Mudanças no Banco de Dados (Supabase)
- Alterar tabela `public.products`:
  - Adicionar coluna `product_type` (enum: 'simple', 'kit') com padrão 'simple'.
- Criar tabela `public.product_kit_components`:
  - `id` (uuid, primary key)
  - `parent_id` (uuid, references products.id) - O kit
  - `component_id` (uuid, references products.id) - O item do kit
  - `quantity` (numeric, not null)
  - `created_at`, `updated_at`
- Habilitar RLS e criar políticas para a nova tabela.

## 2. Frontend - Formulário de Produto
- **GeneralInfoForm.tsx**: Adicionar toggle `Tipo de Produto`.
- **ProductForm/index.tsx**:
  - Gerenciar estado de composição.
  - Implementar aba "Composição do Kit" condicional.
  - Desabilitar campos de custo e estoque manual quando for kit.
- **KitCompositionModule.tsx** (Novo): Módulo para busca e listagem de componentes com cálculos em tempo real.

## 3. Lógica de Negócio (Calculada)
- **Custo do Kit**: Soma de `componente.cost * quantidade`.
- **Estoque do Kit**: `min(componente.stock / quantidade)`.

## 4. Back-end / Automação (Supabase Triggers/Functions)
- Criar trigger/função para processar a baixa de estoque em cascata.
- Quando uma venda é inserida, se o item for um `kit`, buscar componentes e realizar `decrement_stock` em cada um.
