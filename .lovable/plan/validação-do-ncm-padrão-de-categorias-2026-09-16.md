# Validação do NCM padrão de categorias

## Alteração
- Importar as funções existentes de normalização e validação fiscal.
- Normalizar o NCM carregado ao editar uma categoria.
- Aceitar no campo somente números, limitados a 8 dígitos.
- Bloquear o salvamento quando o NCM preenchido não tiver exatamente 8 dígitos, exibindo uma mensagem amigável.

## Escopo
- Alterar exclusivamente `src/features/products/components/category-management-dialog.tsx`.
- Preservar toda a lógica restante do formulário.

## Validação
- Confirmar que o projeto continua compilando sem erros após a mudança.
