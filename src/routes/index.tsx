import { Sparkles, CheckCircle2, Package, Search, History, Truck, AlertCircle, FileSearch } from "lucide-react";
import { Section } from "@/components/design";

export default function Index() {
  return (
    <div className="space-y-6">
      <Section
        title={
          <span className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Redesenho da Calculadora de Frete
          </span>
        }
      >
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          Redesenhe SOMENTE a interface da tela Ferramentas &gt; Calculadora de Frete / Frete e Etiquetas.

          IMPORTANTE:
          - NÃO altere a lógica de cálculo.
          - NÃO altere a integração SuperFrete.
          - NÃO altere APIs/server functions.
          - NÃO altere autenticação, Supabase, banco ou RLS.
          - NÃO altere payloads nem regras de negócio.
          - NÃO altere geração de etiquetas.
          - NÃO altere outros módulos do NexOS.
          - Se encontrar erro funcional da SuperFrete, apenas reporte; não corrija nesta tarefa.

          Quero uma tela com aparência PREMIUM e consistente com o NexOS ERP.

          PROBLEMAS DA TELA ATUAL:
          - muito espaço vazio à direita;
          - hierarquia visual fraca;
          - cards demais;
          - formulário parece isolado;
          - alerta de erro vermelho ocupa espaço demais;
          - inputs inconsistentes;
          - botão principal pesado;
          - SuperFrete parece ser o produto, quando é apenas o provedor.

          NOVO LAYOUT:

          HEADER
          - Breadcrumb discreto: Ferramentas &gt; Calculadora de Frete
          - Título: "Frete e Etiquetas"
          - Subtítulo: "Calcule fretes e gere etiquetas para seus pedidos."
          - Pequeno badge indicando "SuperFrete" como integração.

          ÁREA PRINCIPAL
          Criar layout desktop em duas colunas equilibradas.

          COLUNA ESQUERDA — DADOS DO ENVIO

          Card "Origem"
          - CEP de origem
          - manter os botões e funcionalidades atuais;
          - Formato/embalagem;
          - Peso;
          - Largura;
          - Altura;
          - manter seguro/aviso/mão própria existente.

          Card "Destino"
          - manter abas Novo / Recentes;
          - CEP de destino;
          - manter pesquisa de CEP e demais funcionalidades atuais.

          Botão principal:
          "Calcular frete"

          Deve ficar elegante, proporcional e integrado ao design do NexOS.

          COLUNA DIREITA — COTAÇÃO

          Antes de calcular:
          mostrar estado vazio elegante:

          ícone de entrega
          "Cotação de frete"
          "Preencha os dados do envio para consultar as opções disponíveis."

          Depois do cálculo:
          preservar TODOS os resultados atuais, mas organizar de maneira profissional.

          Cada opção deve destacar:
          - transportadora/serviço;
          - prazo;
          - preço;
          - ações existentes.

          Não remover nenhuma funcionalidade existente.

          ERRO

          O erro atual gigante:

          "ERRO NO CÁLCULO
          Falha ao calcular frete na SuperFrete..."

          deve virar um alerta compacto dentro do painel de cotação.

          Exemplo:

          ⚠ Não foi possível calcular o frete

          Verifique os CEPs e as dimensões informadas e tente novamente.

          [Tentar novamente]

          Manter os logs técnicos existentes no console. Não modificar o tratamento técnico.

          ESTILO

          - Dark theme atual do NexOS.
          - Visual premium de ERP.
          - Bordas sutis.
          - Radius consistente.
          - Espaçamento profissional.
          - Tipografia hierárquica.
          - Inputs uniformes.
          - Estados hover/focus/disabled consistentes.
          - Nada excessivamente colorido.
          - Usar as cores/tokens existentes do NexOS.
          - Não criar uma identidade visual diferente do restante do sistema.

          RESPONSIVIDADE

          Desktop:
          duas colunas equilibradas.

          Notebook:
          reduzir espaçamentos sem criar overflow.

          Mobile:
          empilhar formulário e cotação.

          IMPORTANTE:
          Antes de alterar, localize os componentes atuais da Calculadora de Frete e reutilize toda a lógica existente.

          Faça apenas alterações de UI/estilo.

          Ao terminar:
          1. rode typecheck;
          2. rode build;
          3. confirme quais arquivos de UI foram alterados;
          4. confirme que nenhuma lógica da SuperFrete foi modificada.
        </div>
      </Section>
    </div>
  );
}
