import type { BellaActionIntent, BellaActionParser, BellaActionType } from "./types";

/**
 * Parser baseado em palavras-chave. Determinístico, sem IA.
 * Substituível por um parser LLM sem alterar o restante da arquitetura.
 */

interface KeywordRule {
  action: BellaActionType;
  keywords: string[];
  boosters?: string[];
}

const RULES: KeywordRule[] = [
  {
    action: "GET_CASH_BALANCE",
    keywords: ["caixa", "saldo", "dinheiro", "conta"],
    boosters: ["atual", "agora", "hoje"],
  },
  {
    action: "GET_MONTH_REVENUE",
    keywords: ["receita", "receitas", "faturamento", "entrada", "entradas", "vendas"],
    boosters: ["mes", "mensal"],
  },
  {
    action: "GET_MONTH_EXPENSES",
    keywords: ["despesa", "despesas", "gasto", "gastos", "saida", "saidas", "custo", "custos"],
    boosters: ["mes", "mensal"],
  },
  {
    action: "GET_OVERDUE_BILLS",
    keywords: ["vencida", "vencidas", "vencido", "vencidos", "atraso", "atrasadas", "atrasados", "inadimplencia"],
    boosters: ["conta", "contas", "boleto", "boletos", "titulo", "titulos"],
  },
  {
    action: "GET_CASHFLOW",
    keywords: ["fluxo", "projecao", "previsao", "cashflow"],
    boosters: ["caixa", "30", "mes", "proximos"],
  },
  {
    action: "GET_FINANCIAL_SUMMARY",
    keywords: ["resumo", "panorama", "situacao", "financeiro", "geral", "visao", "lucro", "lucros", "resultado", "resultados"],
    boosters: ["financeira", "financeiro", "empresa"],
  },
];

/**
 * SKILL_RULES — palavras-chave que disparam a execução de tarefas
 * (camada de Skills). Todas produzem action=EXECUTE_SKILL + skillId.
 * Extração completa do payload não é feita aqui: cabe à Skill devolver
 * `missing_fields` quando necessário.
 */
interface SkillRule {
  skillId: string;
  keywords: string[];
  boosters?: string[];
}

const SKILL_RULES: SkillRule[] = [
  { skillId: "finance.register_expense", keywords: ["registrar", "lancar", "criar", "adicionar"], boosters: ["despesa", "gasto", "conta", "pagar"] },
  { skillId: "finance.register_income", keywords: ["registrar", "lancar", "criar", "adicionar"], boosters: ["receita", "entrada", "receber"] },
  { skillId: "finance.get_cash_balance", keywords: ["saldo", "quanto"], boosters: ["caixa", "conta", "dinheiro", "temos", "banco"] },
  { skillId: "cash.register_supply", keywords: ["suprimento", "suprir"], boosters: ["caixa"] },
  { skillId: "cash.register_withdrawal", keywords: ["sangria", "sangrar", "retirar"], boosters: ["caixa"] },
  { skillId: "customer.create", keywords: ["cadastrar", "criar", "novo"], boosters: ["cliente", "clientes"] },
  { skillId: "customer.update", keywords: ["atualizar", "editar", "alterar"], boosters: ["cliente", "clientes"] },
  { skillId: "customer.find", keywords: ["buscar", "localizar", "encontrar", "procurar"], boosters: ["cliente", "clientes"] },
  { skillId: "product.create", keywords: ["cadastrar", "criar", "novo"], boosters: ["produto", "produtos"] },
  { skillId: "product.update_stock", keywords: ["ajustar", "atualizar", "movimentar"], boosters: ["estoque"] },
  { skillId: "product.find", keywords: ["buscar", "localizar", "encontrar", "procurar"], boosters: ["produto", "produtos"] },
  { skillId: "agenda.create_appointment", keywords: ["agendar", "marcar", "criar"], boosters: ["agendamento", "compromisso", "agenda", "horario"] },
  { skillId: "service_order.create", keywords: ["criar", "abrir", "nova"], boosters: ["os", "ordem", "servico"] },
  { skillId: "quote.create", keywords: ["criar", "gerar", "novo"], boosters: ["orcamento", "orcamentos", "proposta"] },
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function tokenize(input: string): string[] {
  return normalize(input).split(/\s+/).filter(Boolean);
}

function matchRule(tokens: Set<string>, rule: KeywordRule) {
  const kws = rule.keywords.map(normalize);
  const bst = (rule.boosters ?? []).map(normalize);
  const matched = kws.filter((k) => tokens.has(k));
  const boosted = bst.filter((k) => tokens.has(k));
  if (matched.length === 0) return null;
  const confidence = Math.min(0.95, 0.6 + (matched.length - 1) * 0.1 + boosted.length * 0.1);
  return { matched: [...matched, ...boosted], confidence };
}

/**
 * Skill match: exige que ao menos 1 keyword E 1 booster estejam
 * presentes — evita falsos positivos como "criar" isolado.
 */
function matchSkill(tokens: Set<string>, rule: SkillRule) {
  const kws = rule.keywords.map(normalize);
  const bst = (rule.boosters ?? []).map(normalize);
  const matchedKw = kws.filter((k) => tokens.has(k));
  const matchedBst = bst.filter((k) => tokens.has(k));
  if (matchedKw.length === 0 || (bst.length > 0 && matchedBst.length === 0)) return null;
  const confidence = Math.min(0.95, 0.7 + matchedBst.length * 0.1);
  return { matched: [...matchedKw, ...matchedBst], confidence };
}

/**
 * Detecta confirmações positivas em mensagens curtas (sim, ok, confirma...).
 * Usado pelo engine quando há uma Skill aguardando confirmação humana.
 */
export function isConfirmationMessage(message: string): boolean {
  const n = normalize(message).trim();
  return /^(sim|s|ok|okay|claro|isso|manda(r)?|pode|pode ser|confirma(r|do)?|com certeza|positivo)\.?$/.test(n);
}

/** Detecta cancelamentos (não, cancela, esquece...). */
export function isCancelMessage(message: string): boolean {
  const n = normalize(message).trim();
  return /^(nao|n|cancela(r)?|esquece(r)?|para(r)?|desiste|negativo)\.?$/.test(n);
}

/**
 * Extrai um payload inicial a partir da mensagem que disparou a Skill.
 * Heurísticas leves: pega o texto que vem depois da palavra-chave do
 * domínio (ex.: "cliente João" → { name: "João" }). Se não conseguir
 * inferir nada, devolve {} — a Skill pedirá os campos ao usuário.
 */
function extractInitialPayload(skillId: string, message: string): Record<string, unknown> {
  const raw = message.trim();
  if (!raw) return {};
  const lower = normalize(raw);

  const afterWord = (word: string): string | null => {
    const idx = lower.indexOf(word);
    if (idx === -1) return null;
    const tail = raw.slice(idx + word.length).trim();
    return tail || null;
  };

  switch (skillId) {
    case "customer.create":
    case "customer.update":
    case "customer.find": {
      const v = afterWord("cliente") ?? afterWord("clientes");
      return v ? (skillId === "customer.find" ? { query: v } : { name: v }) : {};
    }
    case "product.create":
    case "product.find": {
      const v = afterWord("produto") ?? afterWord("produtos");
      return v ? (skillId === "product.find" ? { query: v } : { name: v }) : {};
    }
    default:
      return {};
  }
}

export const keywordParser: BellaActionParser = {
  parse(message: string): BellaActionIntent | null {
    if (!message?.trim()) return null;
    const tokens = new Set(tokenize(message));
    if (tokens.size === 0) return null;

    let best: BellaActionIntent | null = null;

    // Consultas (leitura de métricas)
    for (const rule of RULES) {
      const hit = matchRule(tokens, rule);
      if (!hit) continue;
      if (!best || hit.confidence > best.confidence) {
        best = { action: rule.action, confidence: hit.confidence, matchedKeywords: hit.matched };
      }
    }

    // Execução (Skills). Ganha empate por ter confidence mais alto.
    for (const rule of SKILL_RULES) {
      const hit = matchSkill(tokens, rule);
      if (!hit) continue;
      if (!best || hit.confidence > best.confidence) {
        best = {
          action: "EXECUTE_SKILL",
          confidence: hit.confidence,
          matchedKeywords: hit.matched,
          skillId: rule.skillId,
          payload: extractInitialPayload(rule.skillId, message),
        };
      }
    }

    return best;
  },
};
