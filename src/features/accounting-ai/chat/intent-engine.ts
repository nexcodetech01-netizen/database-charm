/**
 * Intent Engine — 100% puro e determinístico.
 * Apenas identifica a intenção; não executa nada e não calcula nada.
 */
import type { BellaIntentId, ChatContextState, IntentMatch } from "./types";

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
  duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500,
  seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};

/** Extrai um valor monetário citado ("5000", "R$ 5.000,00", "cinco mil"). */
export function extractAmount(raw: string): number | null {
  const text = normalize(raw);

  const digits = text.match(/\d[\d.]*(?:,\d{1,2})?/g);
  if (digits && digits.length > 0) {
    for (const token of digits) {
      const value = Number(token.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) continue;
      const scaled = /\bmil\b/.test(text) && value < 1000 ? value * 1000 : value;
      return scaled;
    }
  }

  const words = text.split(" ");
  let total = 0;
  let current = 0;
  let found = false;
  for (const word of words) {
    if (word === "mil") {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
      found = true;
      continue;
    }
    if (word === "e") continue;
    const value = NUMBER_WORDS[word];
    if (value === undefined) {
      if (found && current === 0) break;
      continue;
    }
    current += value;
    found = true;
  }
  const amount = total + current;
  return found && amount > 0 ? amount : null;
}

interface IntentRule {
  intent: BellaIntentId;
  /** Peso maior vence empates; regras compostas têm prioridade. */
  weight: number;
  terms: string[][];
}

/** Cada entrada de `terms` é um conjunto de termos alternativos (OR). */
const RULES: IntentRule[] = [
  {
    intent: "situacao_geral",
    weight: 12,
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
    weight: 13,
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
    weight: 14,
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
    weight: 13,
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
    intent: "consultar_notificacoes",
    weight: 10,
    terms: [["notificacao", "notificacoes", "avisos", "o que voce percebeu hoje"]],
  },
  {
    intent: "pontos_atencao",
    weight: 11,
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
    weight: 10,
    terms: [
      ["posso retirar", "quanto posso retirar", "posso tirar", "quanto tirar", "retirada", "retirar do caixa", "posso sacar"],
    ],
  },
  {
    intent: "consultar_risco",
    weight: 9,
    terms: [["risco", "arriscado", "perigo", "seguranca financeira"]],
  },
  {
    intent: "consultar_disponibilidade",
    weight: 9,
    terms: [["disponivel", "disponibilidade", "comprometido", "compromissos", "sobra"]],
  },
  {
    intent: "consultar_prolabore",
    weight: 9,
    terms: [["pro labore", "prolabore", "meu salario", "quanto me pagar"]],
  },
  {
    intent: "consultar_reserva",
    weight: 9,
    terms: [["reserva", "quanto reservar", "quanto guardar", "guardar dinheiro"]],
  },
  {
    intent: "consultar_fluxo",
    weight: 8,
    terms: [["fluxo de caixa", "projecao", "previsao de caixa", "proximos 30 dias", "vai entrar", "vai sair"]],
  },
  {
    intent: "consultar_dre",
    weight: 8,
    terms: [["dre", "demonstrativo", "resultado do exercicio"]],
  },
  {
    intent: "consultar_impostos",
    weight: 8,
    terms: [["imposto", "impostos", "tributo", "tributos", "fiscal", "quanto vou pagar de imposto"]],
  },
  {
    intent: "consultar_ticket",
    weight: 8,
    terms: [["ticket medio", "ticket", "valor medio por venda"]],
  },
  {
    intent: "consultar_clientes",
    weight: 8,
    terms: [["cliente", "clientes", "quem mais compra", "melhores compradores"]],
  },
  {
    intent: "consultar_produtos",
    weight: 8,
    terms: [["produto", "produtos", "mais vendido", "campeao de venda", "sem giro", "parado no estoque"]],
  },
  {
    intent: "consultar_saude",
    weight: 7,
    terms: [["saude financeira", "saude", "score", "esta saudavel"]],
  },
  {
    intent: "consultar_alertas",
    weight: 7,
    terms: [["alerta", "alertas", "critico", "urgente"]],
  },
  {
    intent: "consultar_recomendacoes",
    weight: 7,
    terms: [["recomendacao", "recomendacoes", "o que fazer", "sugestao", "sugestoes", "me aconselha"]],
  },
  {
    intent: "consultar_insights",
    weight: 6,
    terms: [["insight", "insights", "analise", "o que voce percebeu"]],
  },
  {
    intent: "consultar_lucro",
    weight: 6,
    terms: [["lucro", "lucrei", "lucrando", "margem", "resultado liquido"]],
  },
  {
    intent: "consultar_caixa",
    weight: 6,
    terms: [["caixa", "saldo", "quanto tenho", "dinheiro em conta", "a pagar", "a receber"]],
  },
  {
    intent: "consultar_receita",
    weight: 5,
    terms: [["vendi", "vendas", "faturamento", "faturei", "receita", "quanto entrou"]],
  },
];

/** Perguntas de seguimento sem sujeito próprio ("e agora?", "e daí?"). */
const FOLLOW_UP_ONLY = /^(e|entao|ok|certo|mas|sim)?\s*(ai|agora|dai|entao|isso|e ai)?\s*[.?!]*$/;

export interface DetectIntentOptions {
  context?: ChatContextState | null;
}

export function detectIntent(raw: string, options: DetectIntentOptions = {}): IntentMatch {
  const text = normalize(raw);
  const amount = extractAmount(raw);
  const context = options.context ?? null;

  if (!text) {
    return { intent: "desconhecida", confidence: 0, matched: [], amount: null, fromContext: false };
  }

  let best: { rule: IntentRule; matched: string[]; score: number } | null = null;

  for (const rule of RULES) {
    const matched: string[] = [];
    let groupsHit = 0;
    for (const group of rule.terms) {
      const hit = group.find((term) => text.includes(term));
      if (hit) {
        matched.push(hit);
        groupsHit += 1;
      }
    }
    if (groupsHit !== rule.terms.length) continue;
    const longest = matched.reduce((acc, t) => Math.max(acc, t.length), 0);
    const score = rule.weight * 100 + longest;
    if (!best || score > best.score) best = { rule, matched, score };
  }

  if (best) {
    const confidence = Math.min(1, 0.5 + best.matched.join(" ").length / 40);
    return {
      intent: best.rule.intent,
      confidence: Number(confidence.toFixed(2)),
      matched: best.matched,
      amount,
      fromContext: false,
    };
  }

  // Seguimento de conversa: reaproveita a última intenção conhecida.
  if (context?.lastIntent && FOLLOW_UP_ONLY.test(text)) {
    return {
      intent: context.lastIntent,
      confidence: 0.4,
      matched: [],
      amount: amount ?? context.lastAmount,
      fromContext: true,
    };
  }

  return { intent: "desconhecida", confidence: 0, matched: [], amount, fromContext: false };
}
