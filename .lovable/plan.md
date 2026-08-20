# Reestruturação Visual da Calculadora de Frete (Estilo SuperFrete)

Este plano detalha a reestruturação da interface da Calculadora de Frete para alinhar-se à hierarquia visual da SuperFrete em Dark Mode, garantindo uma experiência compacta e profissional.

## Alterações Propostas

### 1. Estrutura de Seções (Cards de Origem e Destino)
- **Implementação**: Ajustar os containers "INFORME A ORIGEM" e "INFORME O DESTINO" para usarem estilos de cards arredondados com fundo levemente contrastante (`bg-sidebar/40` ou `bg-muted/10`).
- **Títulos**: Padronizar os rótulos de seção em caixa alta, negrito e com o espaçamento especificado.

### 2. Refatoração de Inputs e Campos
- **Layout**: Mudar a hierarquia dos inputs para que o label fique acima do campo de texto, reduzindo ruído visual.
- **Botões de Ação**: Mover os botões "Salvar" e "Limpar" para o lado direito do input de CEP de Origem, otimizando o espaço vertical.
- **Campos de Dimensão**: Organizar os campos de Peso, Altura, Largura e Comprimento em uma grade compacta.

### 3. Navegação de Destino
- **Abas**: Implementar abas "Novo" e "Recentes" para o CEP de destino com uma linha indicadora (border-bottom) para a aba ativa, substituindo o estilo de botões atual dos `Tabs`.

### 4. Chamada para Ação (CTA)
- **Botão de Cálculo**: Redesenhar o botão "Calcular frete com desconto" para ocupar 100% da largura, com fundo verde vibrante (`bg-emerald-500` ou similar), bordas arredondadas e tipografia bold.

### 5. Estado Vazio e Resultados
- **Painel Direito**: Refinar a área de exibição das cotações. No estado inicial, exibir um placeholder com ícone e a mensagem "Escolha as dimensões e clique em calcular".

## Detalhes Técnicos
- **Arquivo**: `src/routes/_authenticated/ferramentas.calculadora-frete.tsx`
- **Componentes**: `Tabs`, `Form`, `Card`, `Button`, `Input`.
- **Estilização**: Tailwind CSS v4 utility classes.
- **Ícones**: Lucide React.
