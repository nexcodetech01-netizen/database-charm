/**
 * Guia de uso do NexOS (T&G). Texto em markdown, uma seção por tema.
 * Para atualizar: edite o texto da seção. A busca da página procura no
 * título e no texto.
 */
export interface GuideSection {
  id: string;
  title: string;
  body: string;
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "rotina",
    title: "Rotina do dia",
    body: `Cada parte responde a uma pergunta do dia a dia. Use a busca acima para achar a palavra ("troca", "etiqueta", "caixa"). Se algo der erro, veja **Problemas comuns**.

1. **Abrir o caixa:** Caixa › Abrir caixa, com o troco que está na gaveta.
2. **Vender:** PDV. Venda em Pix, cartão, dinheiro ou crediário.
3. **Receber crediário:** Crediário › Registrar recebimento, sempre com a forma certa (Pix ou dinheiro).
4. **Fechar o caixa:** Caixa › Fechar caixa. Conte só o dinheiro da gaveta.
5. **Olhar o Dashboard:** se aparecer a faixa amarela ou vermelha, abra a **Saúde do sistema**.`,
  },
  {
    id: "pdv",
    title: "Vender no PDV",
    body: `Toda venda passa pelo **PDV**, com o caixa aberto. O estoque baixa sozinho quando a venda é paga ou vai para o crediário.

1. **Cliente:** escolha a cliente (ou ➕ Novo). Crediário e vale-troca exigem cliente.
2. **Peças:** busque pelo nome ou bipe o código. Digitando o código exato (SKU ou código de barras), aparece só aquela peça.
3. **Desconto:** no item (preço do item) ou na venda toda.
4. **Finalizar:** escolha a forma de pagamento.

| Forma | Onde o dinheiro entra | Observação |
| --- | --- | --- |
| Dinheiro | Caixa Principal | Entra na conferência do caixa |
| Pix | Banco PJ (Nubank) | Confira o valor no app do banco |
| Cartão | InfinitePay (maquininha) | A taxa da maquininha é lançada sozinha |
| Crediário | Fica a receber | A entrada (se houver) entra na hora |
| Vale-troca | Não entra dinheiro | Toque em "Usar vale-troca" com a cliente escolhida |

**Fechou o pagamento sem pagar?** A venda fica como rascunho. Ao refazer, o rascunho é descartado sozinho.`,
  },
  {
    id: "trocas",
    title: "Trocas e devoluções",
    body: `Regra de ouro: **troca não cancela a venda**. A peça devolvida volta ao estoque e vira **vale-troca**; não sai dinheiro do caixa.

**Troca simples (a cliente troca por outra peça)**

1. Abra a venda original em **Vendas** e clique em **Troca**.
2. Marque a peça devolvida. O valor do vale já desconta o desconto que ela teve.
3. No **PDV**, escolha a mesma cliente, coloque a peça nova e toque em **Usar vale-troca**.
    - Peça nova mais cara: ela paga só a diferença.
    - Peça nova mais barata: o resto fica de saldo para depois.

**Troca de presente (quem ganhou vem trocar)**

1. Na Troca, em **Quem vai usar o vale**, troque para **quem ganhou o presente** (➕ Novo, se não tiver cadastro).
2. Se foram presentes de pessoas diferentes, faça a Troca em cada venda, sempre escolhendo a mesma pessoa. Os vales somam.
3. No PDV, escolha essa pessoa e use o vale.

**Quando cancelar em vez de trocar**

- Cancele só quando a venda **não aconteceu** (lançada errada) ou quando o dinheiro **volta para a cliente**.
- Venda no crediário ainda não paga não dá para trocar: aí cancelar é o certo.
- Nunca troque **e** cancele a mesma venda: o vale e o estorno se somam.`,
  },
  {
    id: "crediario",
    title: "Crediário",
    body: `O crediário é lançado no PDV (forma **Crediário**) e recebido depois, parcela por parcela.

**Registrar um recebimento**

1. Abra a cliente ou a venda e clique em **Registrar recebimento**.
2. Digite o valor e escolha a **forma certa**:
    - **Pix** → entra no Banco PJ.
    - **Dinheiro** → entra no Caixa. Precisa do caixa aberto.
3. Confirme. Quando a última parcela é paga, a venda vira **Paga** sozinha.

**Caixa fechado?** Ao receber em dinheiro, o sistema oferece **Abrir caixa** ali mesmo e conclui o recebimento depois. Não clique em Confirmar duas vezes.

**Erro comum:** receber em Pix marcando **Dinheiro**. O caixa fica com dinheiro que não existe. Se acontecer, peça ajuda com o número da venda.`,
  },
  {
    id: "produtos",
    title: "Produtos",
    body: `Cada combinação de **marca + modelo/estampa + cor + tamanho** é um produto. Duas peças com o mesmo nome mas estampas diferentes são produtos diferentes.

**Cadastrar uma peça:** Produtos › **Novo produto**. Preencha a **Identificação da peça** (Marca, Modelo/estampa, Cor, Tamanho) e clique em **Completar nome**.

**Cadastrar várias de uma vez (grade):** Produtos › **Cadastrar em grade**.

1. Um **grupo** por tipo de peça: nome, modelo, categoria, custo e preço.
2. Uma **linha** por peça: marca, cor, tamanho, quantidade. **+ Linha** repete a marca e a cor de cima.
3. **Lançar a compra junto** cria a compra (fornecedor, frete, data). Veja **Compras**.

**Buscar:** pelo nome (aceita erro de digitação) ou pelo código exato, que mostra só aquela peça.

**Foto:** no cadastro do produto, ou várias de uma vez em **Mais › Fotos em lote**.

**Mais ›** no topo de Produtos guarda as ferramentas de uso raro: Preencher custos, Preencher NCM, Importar CSV, Otimizar fotos, Fotos em lote.

**Peça repetida?** A Saúde do sistema avisa. Se for **a mesma peça**, os cadastros precisam ser juntados (peça ajuda). Se forem **diferentes**, preencha o Modelo/estampa de cada uma.`,
  },
  {
    id: "compras",
    title: "Compras",
    body: `A compra registra o que você comprou e de quem. O estoque e a conta a pagar **só entram quando a compra é marcada como Recebida**.

**Lançar uma compra (escolha um jeito)**

- **Importar a nota (PDF):** Compras › Importar. Revise as peças, a categoria e o preço de venda e clique em **Confirmar e Preencher Compra**.
- **Cadastrar em grade** (Produtos) com **Lançar a compra junto**: cria as peças e a compra de uma vez.
- **Nova compra** manual, peça por peça.

Use **um jeito só** por nota. Usar dois cria as peças em dobro.

**Quando as peças chegam**

1. Abra a compra e clique em **Marcar como recebida**. O estoque entra e o frete é dividido no custo de cada peça.
2. Em **Financeiro**, dê baixa na conta "Compra Nº …" pelo **Banco PJ**, com a **data em que você pagou**.
3. Imprima as etiquetas: **Imprimir etiquetas** na própria compra.

**Compra já recebida:** dá para mudar data, frete e observações, mas não as peças. Para corrigir quantidade, use um ajuste de estoque.

**Deu erro ao salvar?** Não clique de novo várias vezes. Leia a mensagem e mande um print.`,
  },
  {
    id: "etiquetas",
    title: "Etiquetas",
    body: `Para imprimir direto na térmica (LABEL TERMICA), deixe o **programa de impressão** ligado. Desligado, a etiqueta abre na janela de impressão do navegador.

| Quero imprimir… | Onde | Quantidade |
| --- | --- | --- |
| Várias peças pelo estoque | Produtos: filtre, marque as caixinhas, **Imprimir etiquetas** | 1 por peça em estoque |
| Tudo o que chegou numa compra | Compras › abra a compra › **Imprimir etiquetas** | O que chegou |
| Algumas peças escolhidas | Produtos › **Etiquetas em lote** › busque e adicione | Você escolhe (− / +) |
| Uma peça | Abra o produto › **Etiqueta** | 1 |

Na lista de Produtos, a caixinha do topo marca a página. Com mais produtos no filtro, use **Selecionar todos os X do filtro** (até 500). Peças com estoque 0 ficam de fora.

**Programa de impressão desligado?** No cartão **Programa de impressão**, o botão **Como ligar** mostra os dois comandos para colar no Prompt de Comando.`,
  },
  {
    id: "caixa",
    title: "Caixa",
    body: `O caixa controla **só o dinheiro físico da gaveta**. Pix e cartão não entram na conferência.

1. **Abrir:** Caixa › **Abrir caixa**, com o troco que está na gaveta.
2. **Durante o dia:**
    - **Suprimento:** pôs dinheiro na gaveta (troco).
    - **Sangria:** tirou dinheiro da gaveta (pagou algo, levou para o banco).
3. **Fechar:** Caixa › **Fechar caixa**. Conte o dinheiro e digite em **Dinheiro físico contado**.

O **Dinheiro esperado** = troco inicial + dinheiro recebido + suprimentos − sangrias. Se o contado for diferente, o sistema registra a diferença.

**Levou dinheiro do caixa para o banco?** Lance como **Transferência** (Financeiro), do Caixa para o Banco PJ. Assim os dois saldos ficam certos.`,
  },
  {
    id: "financeiro",
    title: "Financeiro",
    body: `Cada conta do sistema tem que bater com o lugar onde o dinheiro está de verdade.

| Conta no sistema | Onde confere |
| --- | --- |
| Banco PJ (Nubank) | Saldo do app do Nubank PJ |
| Caixa Principal (Dinheiro) | Dinheiro contado na gaveta |
| InfinitePay (maquininha) | Saldo no app da InfinitePay |

**Toda semana:** compare o saldo de cada conta com o lugar real. Se não bater, a Saúde do sistema ajuda a achar.

**Lançamentos que mais dão diferença**

- Pix recebido lançado como dinheiro (ou o contrário).
- Saldo da InfinitePay passado para o Nubank sem lançar a **Transferência**.
- Venda que a Gabriela recebeu e repassou: lance no PDV como **Pix, Banco PJ**.
- Despesa paga de outra conta lançada no Banco PJ.

**Pró-labore:** Financeiro › nova **despesa**, conta **Banco PJ**, com a data do Pix.

**Taxa maquininha:** é lançada sozinha em cada venda no cartão, para o saldo da InfinitePay bater. Dá para desligar em Meios de Pagamento.`,
  },
  {
    id: "saude",
    title: "Saúde do sistema",
    body: `Em **Sistema & Ferramentas › Saúde do sistema**, o NexOS confere se os números batem. Quando há algo a corrigir, aparece uma faixa no topo do Dashboard. Clique num aviso para abrir a venda, o produto ou a compra.

| Aviso | O que significa | O que fazer |
| --- | --- | --- |
| Estoque negativo | Saiu mais peça do que entrou | Conte a peça e faça um ajuste de estoque |
| Venda não baixou o estoque | A peça saiu da loja, mas continua no estoque | Peça ajuda com o número da venda |
| Compra recebida sem entrada no estoque | A compra está recebida, mas as peças não entraram | Peça ajuda antes de mexer |
| Saldo da conta não bate | Algum lançamento está na conta errada ou faltando | Compare com o extrato |
| Vale-troca de venda cancelada | A cliente ficou com vale de uma venda que foi cancelada | Anular o vale |
| Produto cadastrado mais de uma vez | Mesmo nome, estampa, cor e tamanho | Mesma peça: juntar. Diferentes: preencher a estampa |
| Falha na integração | Mercado Livre ou outra integração deu erro | Se for nova, peça ajuda |
| Estoque diferente das entradas e saídas | Cadastro antigo, sem histórico | Estoque › Reconciliação |
| Vendas em rascunho esquecidas | Vendas começadas e não terminadas | Apagar em Vendas |

Depois de corrigir, clique em **Conferir de novo**.`,
  },
  {
    id: "problemas",
    title: "Problemas comuns",
    body: `| Aconteceu | O que fazer |
| --- | --- |
| Uma mudança nova não aparece no app | Clique em **Publish** no Lovable e atualize a página (F5) |
| Recebi um bloco de SQL para rodar | Supabase › SQL Editor › cole › **Run**, na hora. Bloco em partes: uma por vez, na ordem |
| SQL deu "unterminated dollar-quoted string" | A cópia veio cortada. Copie de novo o bloco inteiro |
| O resultado do SQL veio cortado em 100 linhas | Troque "Limit 100" para **No limit** ao lado do Run |
| Mensagem de erro ao salvar | Não clique de novo. Mande um print da mensagem |
| Não consigo entrar | Confira e-mail e senha (o olhinho mostra a senha) ou use **Esqueci minha senha** |
| Etiqueta não sai na térmica | Ligue o programa de impressão (veja **Etiquetas**) |
| Sistema fora do ar / limite do Supabase | Confira o plano no painel do Supabase |`,
  },
];

/** Busca simples, sem acento e sem diferenciar maiúsculas. */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterGuide(sections: GuideSection[], query: string): GuideSection[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return sections;
  return sections.filter((s) => {
    const hay = norm(`${s.title} ${s.body}`);
    return words.every((w) => hay.includes(w));
  });
}
