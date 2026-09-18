# Proteção do reprocessamento de compras

## Objetivo
Impedir que o reprocessamento técnico de uma compra recebida estorne estoque e contas a pagar, preservando reversões reais feitas pela tela.

## Etapas
1. Criar e aplicar uma nova migração que:
   - ignore reversões de estoque e financeiro somente quando a flag transacional `app.purchase_reprocessing` estiver ativa;
   - ative essa flag apenas dentro de `reprocess_received_purchase`, antes da troca técnica `received → pending → received`.
2. Confirmar no banco que as três funções publicadas contêm a proteção e que a flag é local à transação.
3. Consultar, sem alterar dados, a quantidade e os números das compras recebidas com contas marcadas incorretamente como estornadas.
4. Apresentar essa lista para sua conferência e aguardar confirmação antes de executar a correção única dos dados.

## Detalhes técnicos
A migração recriará as versões atualmente vigentes das três funções, adicionando somente a guarda e a flag solicitadas. A correção de dados não fará parte da migração e só será executada após sua confirmação explícita.
