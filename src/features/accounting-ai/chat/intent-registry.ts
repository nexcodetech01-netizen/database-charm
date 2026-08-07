/**
 * Bella Contadora — Intent Registry (Sprint 7.2.1).
 *
 * Tabela DECLARATIVA de precedência das intenções. Nenhuma intent, termo,
 * regex ou prioridade foi alterada nesta extração: o conteúdo é exatamente
 * o mesmo que vivia implícito dentro do `intent-engine`, agora explícito e
 * ordenável. O matcher e o planner continuam sendo os mesmos.
 */
import type { BellaIntentId } from "./types";

export interface IntentRule {
  intent: BellaIntentId;
  /** Prioridade declarativa: maior vence empates. Idêntica ao peso anterior. */
  priority: number;
  terms: string[][];
}

/** Cada entrada de `terms` é um conjunto de termos alternativos (OR). */
export const INTENT_REGISTRY: readonly IntentRule[] = [
  /* ───── Sprint 7.3 — Bella Explica: "por quê?" vence "quanto?" ───── */
  {
    intent: "explicar_resultado",
    priority: 34,
    terms: [
      [
        "maior impacto",
        "qual foi o maior impacto",
        "o que mais impactou",
        "o que mais pesou",
        "principais impactos",
        "explique o resultado",
        "explicar o resultado",
        "por que meu resultado",
        "porque meu resultado",
      ],
    ],
  },
  {
    intent: "explicar_lucro",
    priority: 33,
    terms: [
      [
        "por que meu lucro",
        "porque meu lucro",
        "por que o lucro",
        "porque o lucro",
        "por que a margem",
        "porque a margem",
        "explique meu lucro",
        "explicar o lucro",
        "motivo da queda do lucro",
        "lucro caiu por que",
      ],
    ],
  },
  {
    intent: "explicar_caixa",
    priority: 33,
    terms: [
      [
        "por que meu caixa",
        "porque meu caixa",
        "por que o caixa",
        "porque o caixa",
        "por que meu saldo",
        "porque meu saldo",
        "explique meu caixa",
        "explicar o caixa",
        "cade meu dinheiro",
        "onde foi meu dinheiro",
      ],
    ],
  },
  {
    intent: "explicar_receita",
    priority: 33,
    terms: [
      [
        "por que minha receita",
        "porque minha receita",
        "por que a receita",
        "porque a receita",
        "por que vendi menos",
        "porque vendi menos",
        "por que vendi mais",
        "porque vendi mais",
        "por que meu faturamento",
        "porque meu faturamento",
        "explique minha receita",
        "explicar a receita",
      ],
    ],
  },
  {
    intent: "explicar_despesas",
    priority: 33,
    terms: [
      [
        "por que minhas despesas",
        "porque minhas despesas",
        "por que as despesas",
        "porque as despesas",
        "por que meus custos",
        "porque meus custos",
        "por que o cmv",
        "porque o cmv",
        "explique minhas despesas",
        "explicar as despesas",
        "gastei mais por que",
      ],
    ],
  },
  {
    intent: "explicar_impostos",
    priority: 33,
    terms: [
      [
        "por que meu das",
        "porque meu das",
        "por que o das",
        "porque o das",
        "por que meu imposto",
        "porque meu imposto",
        "por que os impostos",
        "porque os impostos",
        "explique meu das",
        "explicar o das",
        "das aumentou",
      ],
    ],
  },
  {
    intent: "explicar_ticket",
    priority: 33,
    terms: [
      [
        "por que meu ticket",
        "porque meu ticket",
        "por que o ticket",
        "porque o ticket",
        "explique o ticket",
        "explicar o ticket medio",
      ],
    ],
  },
  {
    intent: "explicar_estoque",
    priority: 33,
    terms: [
      [
        "por que meu estoque",
        "porque meu estoque",
        "por que o estoque",
        "porque o estoque",
        "explique meu estoque",
        "explicar o estoque",
      ],
    ],
  },
  {
    intent: "explicar_indicadores",
    priority: 32,
    terms: [
      [
        "explique meus indicadores",
        "explicar os indicadores",
        "me explique os numeros",
        "explique os numeros",
        "por que meus numeros",
        "porque meus numeros",
        "me explica",
        "pode explicar",
        "explique",
      ],
    ],
  },
  {
    /** Sprint 7.2 — auditoria: pergunta aberta sobre inconsistências. */
    intent: "auditoria_geral",
    priority: 24,
    terms: [
      [
        "o que esta errado",
        "o que está errado",
        "auditar",
        "auditoria",
        "faca uma auditoria",
        "faça uma auditoria",
        "audite a empresa",
        "revisar meus dados",
        "revise meus dados",
        "conferir meus dados",
        "tem algo errado",
        "algo errado",
      ],
    ],
  },
  {
    intent: "consultar_inconsistencias",
    priority: 23,
    terms: [
      [
        "inconsistencia",
        "inconsistencias",
        "inconsistência",
        "inconsistências",
        "erros nos dados",
        "erros no sistema",
        "problemas nos dados",
        "divergencias",
        "divergências",
        "o que preciso corrigir",
        "o que devo corrigir",
      ],
    ],
  },
  {
    intent: "consultar_saude_operacional",
    priority: 23,
    terms: [
      [
        "saude operacional",
        "saúde operacional",
        "como esta a operacao",
        "como está a operação",
        "qualidade dos dados",
        "score operacional",
      ],
    ],
  },
  {
    /** Sprint 7.1 — simulação tributária (motor oficial de projeções). */
    intent: "simular_faturamento",
    priority: 22,
    terms: [
      [
        "se eu faturar",
        "se eu vender",
        "e se eu faturar",
        "simular faturamento",
        "simule um faturamento",
        "simulacao de faturamento",
        "quanto pagaria se",
        "se crescer",
        "se eu crescer",
        "crescer",
        "crescimento de",
        "aumentar o faturamento",
      ],
    ],
  },
  {
    intent: "simular_das",
    priority: 21,
    terms: [
      [
        "simular das",
        "simule o das",
        "simulacao do das",
        "simular imposto",
        "simular tributos",
        "simulacao tributaria",
        "cenarios de imposto",
        "cenario tributario",
      ],
    ],
  },
  {
    intent: "consultar_vencimento_das",
    priority: 20,
    terms: [
      [
        "quando vence o das",
        "vencimento do das",
        "quando pagar o das",
        "prazo do das",
        "data do das",
        "quando vence o imposto",
      ],
    ],
  },
  {
    intent: "consultar_rbt12",
    priority: 20,
    terms: [
      [
        "rbt12",
        "rbt 12",
        "receita bruta acumulada",
        "faturamento dos ultimos 12 meses",
        "ultimos 12 meses",
        "teto do simples",
        "limite do simples",
        "quanto falta para estourar",
      ],
    ],
  },
  {
    intent: "consultar_faixa",
    priority: 20,
    terms: [
      [
        "qual minha faixa",
        "minha faixa",
        "faixa do simples",
        "mudar de faixa",
        "mudanca de faixa",
        "proxima faixa",
        "vou mudar de faixa",
      ],
    ],
  },
  {
    intent: "consultar_anexo",
    priority: 19,
    terms: [
      [
        "qual meu anexo",
        "meu anexo",
        "anexo do simples",
        "qual anexo",
        "meu regime",
        "qual meu regime",
        "regime tributario",
        "estou no simples",
      ],
    ],
  },
  {
    intent: "consultar_aliquota",
    priority: 19,
    terms: [
      [
        "aliquota",
        "aliquota efetiva",
        "qual minha aliquota",
        "quanto por cento de imposto",
        "percentual de imposto",
        "carga tributaria",
      ],
    ],
  },
  {
    intent: "consultar_das",
    priority: 19,
    terms: [
      [
        "quanto vou pagar de das",
        "pagar de das",
        "meu das",
        "valor do das",
        "das do mes",
        "das da competencia",
        "guia do simples",
        "simples nacional",
      ],
    ],
  },
  {
    intent: "situacao_tributaria",
    priority: 18,
    terms: [
      [
        "situacao tributaria",
        "como esta meu tributario",
        "como esta o tributario",
        "meu tributario",
        "resumo tributario",
        "panorama tributario",
      ],
    ],
  },
  {
    intent: "situacao_geral",
    priority: 12,
    terms: [
      [
        "como esta minha empresa",
        "como esta a empresa",
        "como estamos",
        "como esta o negocio",
        "situacao da empresa",
        "resumo geral",
        "resumo executivo",
        "panorama",
        "visao geral",
        "como vai a empresa",
      ],
    ],
  },
  {
    intent: "resumo_do_dia",
    priority: 13,
    terms: [
      [
        "o que aconteceu hoje",
        "o que aconteceu",
        "novidades",
        "tem alguma novidade",
        "resumo do dia",
        "como foi o dia",
        "me atualiza",
        "o que mudou hoje",
      ],
    ],
  },
  {
    intent: "situacao_fiscal",
    priority: 14,
    terms: [
      [
        "como esta meu fiscal",
        "como esta o fiscal",
        "situacao fiscal",
        "minha situacao fiscal",
        "como estao minhas notas",
        "como estao as notas",
        "minhas notas fiscais",
        "notas fiscais",
        "nfe",
        "nfc e",
        "nota rejeitada",
        "notas rejeitadas",
      ],
    ],
  },
  {
    intent: "situacao_estoque",
    priority: 13,
    terms: [
      [
        "como esta meu estoque",
        "como esta o estoque",
        "situacao do estoque",
        "meu estoque",
        "o que preciso comprar",
        "o que comprar",
        "preciso repor",
        "o que esta acabando",
        "esta acabando",
        "produtos parados",
        "estao parados",
        "parados",
        "esta parado",
        "produto parado",
        "sem giro",
        "estoque baixo",
        "abaixo do minimo",
        "falta estoque",
        "sem estoque",
        "ruptura",
      ],
    ],
  },
  {
    /** Sprint 6.5 — Bella Compras: pedidos, fornecedores e reposição. */
    intent: "situacao_compras",
    priority: 16,
    terms: [
      [
        "como estao minhas compras",
        "como estao as compras",
        "situacao das compras",
        "situacao de compras",
        "minhas compras",
        "as compras",
        "pedidos atrasados",
        "pedido atrasado",
        "tenho pedidos atrasados",
        "pedidos pendentes",
        "pedido pendente",
        "aguardando recebimento",
        "qual fornecedor compra mais",
        "melhor fornecedor",
        "fornecedor que mais compro",
        "meus fornecedores",
        "produtos precisam de reposicao",
        "precisam de reposicao",
        "quais produtos repor",
      ],
    ],
  },
  {
    /** Sprint 6.6 — Bella CRM: base, recorrência, inatividade e ranking. */
    intent: "situacao_crm",
    priority: 17,
    terms: [
      [
        "como estao meus clientes",
        "como estao os clientes",
        "situacao dos clientes",
        "situacao de clientes",
        "meus clientes",
        "minha base de clientes",
        "base de clientes",
        "quem compra mais",
        "quem mais compra",
        "melhor cliente",
        "meus melhores clientes",
        "quem esta parado",
        "clientes parados",
        "clientes inativos",
        "cliente inativo",
        "quem devo recuperar",
        "clientes para recuperar",
        "recuperar clientes",
        "quem gera mais faturamento",
        "cliente que mais fatura",
        "quem tem maior ticket",
        "maior ticket",
        "clientes novos",
        "clientes recorrentes",
      ],
    ],
  },
  {
    intent: "situacao_vendas",
    priority: 15,
    terms: [
      [
        "como estao minhas vendas",
        "como estao as vendas",
        "como esta minha venda",
        "situacao das vendas",
        "situacao de vendas",
        "minhas vendas",
        "as vendas",
        "o que mais vende",
        "o que mais vendeu",
        "melhor cliente",
        "vendas caindo",
        "cai as vendas",
        "caiu as vendas",
        "vendas canceladas",
      ],
    ],
  },
  {
    intent: "consultar_notificacoes",
    priority: 10,
    terms: [["notificacao", "notificacoes", "avisos", "o que voce percebeu hoje"]],
  },
  {
    intent: "pontos_atencao",
    priority: 11,
    terms: [
      [
        "precisa da minha atencao",
        "merece atencao",
        "preciso me preocupar",
        "o que devo olhar",
        "pontos de atencao",
        "algo errado",
        "o que esta ruim",
        "o que precisa de atencao",
      ],
    ],
  },
  {
    intent: "consultar_retirada",
    priority: 10,
    terms: [
      ["posso retirar", "quanto posso retirar", "posso tirar", "quanto tirar", "retirada", "retirar do caixa", "posso sacar", "se eu tirar", "impacto de retirar"],
    ],
  },
  {
    intent: "consultar_risco",
    priority: 9,
    terms: [["risco", "arriscado", "perigo", "seguranca financeira", "e seguro", "corro risco"]],
  },
  {
    intent: "consultar_disponibilidade",
    priority: 9,
    terms: [["disponivel", "disponibilidade", "comprometido", "compromissos", "sobra", "quanto sobra"]],
  },
  {
    intent: "consultar_prolabore",
    priority: 9,
    terms: [["pro labore", "prolabore", "meu salario", "quanto me pagar", "quanto devo retirar", "pro labore recomendado"]],
  },
  {
    intent: "consultar_reserva",
    priority: 9,
    terms: [["reserva", "quanto reservar", "quanto guardar", "guardar dinheiro", "reserva de emergencia", "reserva financeira"]],
  },
  {
    intent: "consultar_fluxo",
    priority: 8,
    terms: [["fluxo de caixa", "projecao", "previsao de caixa", "proximos 30 dias", "vai entrar", "vai sair"]],
  },
  {
    intent: "consultar_dre",
    priority: 8,
    terms: [["dre", "demonstrativo", "resultado do exercicio"]],
  },
  {
    intent: "consultar_impostos",
    priority: 8,
    terms: [["imposto", "impostos", "tributo", "tributos", "fiscal", "quanto vou pagar de imposto"]],
  },
  {
    intent: "consultar_ticket",
    priority: 8,
    terms: [["ticket medio", "ticket", "valor medio por venda"]],
  },
  {
    intent: "consultar_clientes",
    priority: 8,
    terms: [["cliente", "clientes", "quem mais compra", "melhores compradores"]],
  },
  {
    intent: "consultar_produtos",
    priority: 8,
    terms: [["produto", "produtos", "mais vendido", "campeao de venda", "sem giro", "parado no estoque"]],
  },
  {
    intent: "consultar_saude",
    priority: 7,
    terms: [["saude financeira", "saude", "score", "esta saudavel"]],
  },
  {
    intent: "consultar_alertas",
    priority: 7,
    terms: [["alerta", "alertas", "critico", "urgente"]],
  },
  {
    intent: "consultar_recomendacoes",
    priority: 7,
    terms: [["recomendacao", "recomendacoes", "o que fazer", "sugestao", "sugestoes", "me aconselha"]],
  },
  {
    intent: "consultar_insights",
    priority: 6,
    terms: [["insight", "insights", "analise", "o que voce percebeu"]],
  },
  {
    intent: "consultar_lucro",
    priority: 6,
    terms: [["lucro", "lucrei", "lucrando", "margem", "resultado liquido"]],
  },
  {
    intent: "consultar_caixa",
    priority: 6,
    terms: [["caixa", "saldo", "quanto tenho", "dinheiro em conta", "a pagar", "a receber"]],
  },
  {
    intent: "consultar_receita",
    priority: 5,
    terms: [["vendi", "vendas", "faturamento", "faturei", "receita", "quanto entrou"]],
  },
];

/**
 * Registro ordenado por prioridade decrescente. `sort` é estável, logo
 * empates preservam a ordem de declaração — o mesmo desempate de antes.
 */
export function intentRegistryByPriority(): readonly IntentRule[] {
  return [...INTENT_REGISTRY].sort((a, b) => b.priority - a.priority);
}

/** Prioridade declarada de uma intenção (null quando não registrada). */
export function intentPriority(intent: BellaIntentId): number | null {
  return INTENT_REGISTRY.find((r) => r.intent === intent)?.priority ?? null;
}
