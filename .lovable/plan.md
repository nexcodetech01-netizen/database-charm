# Plano de Implementação - Sprint H1.1 (Fase 5: Validators)

Objetivo: Centralizar todas as validações do módulo Fiscal em uma camada única de **Validators**.

## Mudanças Propostas

### 1. Camada de Validators (`src/features/fiscal/v2/validators/`)
- **Finalização dos Validators**:
    - `CompanyValidator`: Validação de CRT, Séries e dados cadastrais do emitente.
    - `CustomerValidator`: Validação de destinatário para NF-e (obrigatório) e NFC-e (opcional identificado).
    - `ProductValidator`: Validação de itens (NCM, quantidades, preços).
    - `PayloadValidator`: Validação de duplicidade, totais e integridade do payload de envio.
    - `TaxValidator`: Validação de CFOP e grupos de impostos.
    - `CertificateValidator`: Validação de expiração e status do certificado A1.
    - `AuthorizationValidator`: Regras de negócio para permitir cancelamento, descarte ou refresh.

### 2. Refatoração de Services
- **EmissionService**: Migrar lógica de validação de rascunho e simulação para os novos Validators.
- **AuthorizationService / CancellationService**: Utilizar `AuthorizationValidator` para travar fluxos inválidos.

### 3. Refatoração do Motor Fiscal (`nfe-engine.server.ts`)
- Remover validações internas duplicadas.
- Utilizar `PayloadValidator.validateFullContext` antes de processar qualquer envio ao provedor.

### 4. Refatoração de RPCs (`fiscal.functions.ts`)
- Integrar os Validators nas chamadas de entrada para falhar rápido antes de iniciar transações pesadas ou chamadas de motor.

## Detalhes Técnicos
- As classes Validator são estáticas e puras (sem dependências de banco de dados ou estado).
- Erros de validação lançam `Error` com mensagens amigáveis para o usuário.
- O motor captura esses erros e os registra na timeline do documento como eventos de rejeição.

## Verificação
- Execução de `tsgo` para garantir integridade de tipos.
- Execução da suíte de testes existente (`cancellation.test.ts`, `issue-guard.test.ts`).
