# Plano de Implementação: Nova Função "Imprimir Etiqueta"

Adicionar a funcionalidade "Imprimir Etiqueta" no Dashboard do NexOS, permitindo que o usuário selecione um arquivo TXT com comandos ZPL (direto do Mercado Livre), visualize a etiqueta e realize a impressão utilizando o mecanismo de imagem/PNG já homologado.

## 1. Criação do Novo Componente de Diálogo
Criar `src/features/printing/components/GenericLabelPrintDialog.tsx` reutilizando a lógica e o estilo do `ShippingLabelPrintDialog.tsx`, mas com foco em importação de arquivo manual para uso operacional.

- **Interface:** Título "Imprimir Etiqueta (Operacional)", subtítulo "Importe o arquivo TXT do Mercado Livre para impressão".
- **Fluxo de Dados:**
    1. Botão "Selecionar Arquivo TXT".
    2. Leitura do arquivo usando `FileReader.readAsText`.
    3. Processamento do conteúdo usando o `parseZPLBlocks` já existente.
    4. Exibição de prévia via `LabelPreview` (que usa `labelaryService.convertToPdf`).
- **Ação de Impressão:** Botão "Imprimir Etiqueta" que chama `printManager.print` com os dados convertidos.

## 2. Integração no Dashboard
Adicionar o novo botão "Imprimir Etiqueta" no `ActionCenter` do Dashboard.

- **Local:** `src/routes/_authenticated/dashboard.tsx`.
- **Mudança:** Adicionar o item ao array `moreActions` do `EntityHeader` e gerenciar o estado `isPrintDialogOpen`.

## 3. Garantias de Reutilização e Segurança
- **Motor de Impressão:** O `printManager.print` já possui a lógica de enviar para o Bridge via `/print/image` se o conteúdo for ZPL (ele mesmo chama o `labelaryService.convertToPng` internamente no `print-bridge.browser.ts`).
- **Proibição de Alterações:** Nenhuma linha do `print-bridge.browser.ts`, `labelary.service.ts` ou da configuração do Bridge será alterada.
- **Isolamento:** A nova função é puramente uma interface de entrada para o fluxo já existente.

## Detalhes Técnicos
- O arquivo `.txt` do Mercado Livre será lido como string.
- O parser identificará se há blocos `^XA ... ^XZ`.
- Se for um ZPL válido, o `LabelPreview` mostrará a imagem.
- Ao imprimir, o `printManager` cuidará da conversão PNG -> Base64 -> Bridge.
- Sucesso confirmado via toast após o retorno do bridge.
