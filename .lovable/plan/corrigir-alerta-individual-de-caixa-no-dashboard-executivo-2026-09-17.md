# Corrigir alerta individual de caixa no Dashboard Executivo

## Objetivo
Fazer o alerta de caixa refletir somente a sessão aberta pelo usuário logado, sem alterar os demais indicadores empresariais.

## Alterações
- Adicionar `operatorId` opcional ao carregamento do Dashboard Executivo.
- Aplicar o filtro `operator_id` somente à consulta de caixas abertos quando o usuário estiver disponível.
- Incluir o operador na chave de cache para impedir compartilhamento de resultado entre usuários.
- Obter o usuário atual no painel e repassar seu identificador ao carregamento.
- Renomear o alerta para “Seu caixa aberto”.

## Validação
- Confirmar que os três pontos usam o mesmo identificador do operador.
- Verificar compilação e o estado mais recente do build.
- Garantir que nenhum outro KPI, gráfico ou alerta foi modificado.

## Detalhes técnicos
A consulta continuará filtrada por empresa e status. O filtro por operador será acrescentado condicionalmente, preservando a assinatura opcional do serviço e do hook.
