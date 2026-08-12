# Sprint H1.1 — Hardening Fiscal — FASE 5 — VALIDATORS

Objetivo: Centralizar todas as validações do módulo Fiscal em uma camada de Validators pura e desacoplada.

## Validators Implementados
- `CompanyValidator`: CRT, Séries e dados do Emitente.
- `CustomerValidator`: Dados do destinatário por modelo (55/65).
- `ProductValidator`: Descrição, NCM, Quantidade e Preços.
- `PayloadValidator`: Duplicidade, CSC (NFC-e), Totais e Contexto de Emissão.
- `CertificateValidator`: Estado ativo e expiração.
- `TaxValidator`: CFOP e Grupos de tributos.
- `AuthorizationValidator`: Elegibilidade para cancelamento, descarte e refresh.
- `CodesValidator`: Formatos de NCM, CEST e CFOP.

## Refatoração de Camadas
- **Services**: `EmissionService`, `AuthorizationService` e `CancellationService` agora delegam validações para os Validators.
- **Motor Fiscal (`nfe-engine.server.ts`)**: Validações de payload e emitente centralizadas via `PayloadValidator.validateFullContext`.
- **Functions (`fiscal.functions.ts`)**: Garantia de integridade em `issueFiscalFromSale` e `discardFiscalDocument` através de Validators.

## Validação Técnica
- Typecheck: OK.
- Testes Core: OK (Cancellation e Issue Guard).
- Tratamento de Erro: Centralizado em `nfe-engine` para registrar eventos de rejeição detalhados.
