/**
 * Intent Engine — Fase 2 do Agent Runtime.
 *
 * Detecta APENAS as intents simples migradas nesta fase:
 *   - customer.search   → skill customer.find
 *   - customer.create   → skill customer.create
 *   - product.search    → skill product.find
 *   - finance.balance   → skill finance.get_cash_balance
 *
 * Qualquer outra mensagem devolve `null`, sinalizando ao runtime
 * que o fluxo legado deve responder (fallback).
 *
 * Determinístico (regex + slot extractor). Sem LLM nesta fase.
 */
import type { AgentIntent } from "./types";

/** Intents suportadas oficialmente pelo runtime nesta fase. */
export const SUPPORTED_RUNTIME_INTENTS = [
  "customer.find",
  "customer.create",
  "product.find",
  "product.search",
  "product.create",
  "product.update_price",
  "product.update_stock",
  "product.list_low_stock",
  "finance.cash_balance",
  "finance.receivable",
  "finance.payable",
  "sale.search",
  "sale.best_customer",
  // Sprint 003 — Estoque
  "stock.add",
  "stock.remove",
  "stock.adjust",
  "stock.history",
  "stock.low",
  "stock.balance",
  "stock.purchase_suggestion",
] as const;
export type SupportedRuntimeIntent = (typeof SUPPORTED_RUNTIME_INTENTS)[number];

interface Rule {
  intent: SupportedRuntimeIntent;
  patterns: RegExp[];
  extract?(text: string): Record<string, unknown>;
  confidence: number;
  destructive?: boolean;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** Captura o "termo" após verbos de busca: "buscar cliente joão silva". */
function captureAfter(text: string, verbs: RegExp): string | null {
  const m = text.match(verbs);
  if (!m) return null;
  const tail = text.slice(m.index! + m[0].length).trim();
  return tail.length > 0 ? tail : null;
}

const RULES: Rule[] = [
  // finance.cash_balance — checar primeiro (mais específico)
  {
    intent: "finance.cash_balance",
    patterns: [
      /\bsaldo (do|de|no|em) caixa\b/,
      /\bqual (o|meu) saldo\b/,
      /\bquanto (tem|ha) (no|em) caixa\b/,
      /\bcaixa (atual|do dia)\b/,
    ],
    confidence: 0.9,
  },
  // Financeiro: Contas a receber
  {
    intent: "finance.receivable",
    patterns: [
      /\bcontas a receber\b/,
      /\bquanto (tenho|temos) a receber\b/,
      /\bvalores pendentes de entrada\b/,
      /\bo que tem para entrar\b/,
    ],
    confidence: 0.9,
  },
  // Financeiro: Contas a pagar
  {
    intent: "finance.payable",
    patterns: [
      /\bcontas a pagar\b/,
      /\bquanto (tenho|temos) a pagar\b/,
      /\bvalores pendentes de saida\b/,
      /\bo que tem para sair\b/,
      /\bdividas pendentes\b/,
    ],
    confidence: 0.9,
  },
  // customer.create — cadastrar cliente
  {
    intent: "customer.create",
    patterns: [/\b(cadastrar|criar|adicionar|novo) cliente\b/, /\bregistrar cliente\b/],
    extract(text) {
      // "cadastrar cliente Maria Silva" → name: "Maria Silva"
      const tail = captureAfter(text, /\b(cadastrar|criar|adicionar|novo|registrar) cliente\b/);
      return tail ? { name: tail } : {};
    },
    confidence: 0.85,
    destructive: false, // create não é destrutivo, mas requer confirmação implícita se faltar campos (a skill lida)
  },
  // customer.find — buscar cliente
  {
    intent: "customer.find",
    patterns: [
      /\b(buscar|procurar|localizar|encontrar|achar|consultar|pesquisar) cliente\b/,
      /\bcliente (chamad[oa]|com nome)\b/,
      /\bquem (e|eh) o cliente\b/,
    ],
    extract(text) {
      const tail = captureAfter(
        text,
        /\b(buscar|procurar|localizar|encontrar|achar|consultar|pesquisar) cliente\b/,
      );
      return tail ? { query: tail } : {};
    },
    confidence: 0.85,
  },
  // product.find — buscar produto
  {
    intent: "product.find",
    patterns: [
      /\b(buscar|procurar|localizar|encontrar|achar|consultar|pesquisar) produto\b/,
      /\bproduto (chamado|com nome|com sku)\b/,
      /\bqual o preco (do|de) (produto|item)\b/,
    ],
    extract(text) {
      const tail = captureAfter(
        text,
        /\b(buscar|procurar|localizar|encontrar|achar|consultar|pesquisar) produto\b/,
      );
      return tail ? { query: tail } : {};
    },
    confidence: 0.85,
  },
  // product.list_low_stock — estoque crítico
  {
    intent: "product.list_low_stock",
    patterns: [
      /\b(produtos?|itens) (com )?estoque (baixo|critico|crítico|minimo|mínimo)\b/,
      /\b(estoque )?abaixo do (minimo|mínimo)\b/,
      /\b(faltando|acabando) (no )?estoque\b/,
    ],
    confidence: 0.9,
  },
  // stock.purchase_suggestion — sugestão de compra
  {
    intent: "stock.purchase_suggestion",
    patterns: [
      /\bpreparar sugestao de compra\b/,
      /\bo que (devo|preciso) comprar\b/,
      /\bsugestao de reposicao\b/,
    ],
    confidence: 0.9,
  },
  // sale.search — consultar vendas
  {
    intent: "sale.search",
    patterns: [
      /\b(consultar|buscar|ver|pesquisar) vendas\b/,
      /\bquanto vendi\b/,
      /\blista de pedidos\b/,
    ],
    confidence: 0.85,
  },
  // sale.best_customer — cliente com maior compra
  {
    intent: "sale.best_customer",
    patterns: [
      /\b(quem|qual) (e|eh) o cliente que mais compra\b/,
      /\bmelhor cliente\b/,
      /\bquem mais compra\b/,
    ],
    confidence: 0.9,
  },
  // product.create — cadastrar produto
  {
    intent: "product.create",
    patterns: [/\b(cadastrar|criar|adicionar|novo) produto\b/, /\bregistrar produto\b/],
    extract(text) {
      const tail = captureAfter(text, /\b(cadastrar|criar|adicionar|novo|registrar) produto\b/);
      return tail ? { name: tail } : {};
    },
    confidence: 0.85,
  },
  // Sprint 003 — Estoque -------------------------------------------------
  // stock.add: "adicione 50 unidades ao produto Cabo USB-C"
  {
    intent: "stock.add",
    patterns: [
      /\b(adicion(e|ar|a)|entrar|dar entrada|somar|incluir) (\d+([.,]\d+)?)( unidades?| un| pcs)? (ao|no|de|em|para) (produto )?/,
    ],
    extract(text) {
      const m = text.match(
        /\b(?:adicion(?:e|ar|a)|entrar|dar entrada|somar|incluir) (\d+(?:[.,]\d+)?)(?: unidades?| un| pcs)? (?:ao|no|de|em|para) (?:produto )?(.+)$/,
      );
      if (!m) return {};
      const qty = Number(m[1].replace(",", "."));
      const query = m[2].trim();
      return Number.isFinite(qty) && query ? { quantity: qty, query } : {};
    },
    confidence: 0.9,
    destructive: true,
  },
  // stock.remove: "retire 3 unidades do produto X"
  {
    intent: "stock.remove",
    patterns: [
      /\b(retir(e|ar|a)|remover|sair|dar saida|baixar|debitar|subtrair) (\d+([.,]\d+)?)( unidades?| un| pcs)? (do|de|no|em) (produto )?/,
    ],
    extract(text) {
      const m = text.match(
        /\b(?:retir(?:e|ar|a)|remover|sair|dar saida|baixar|debitar|subtrair) (\d+(?:[.,]\d+)?)(?: unidades?| un| pcs)? (?:do|de|no|em) (?:produto )?(.+)$/,
      );
      if (!m) return {};
      const qty = Number(m[1].replace(",", "."));
      const query = m[2].trim();
      return Number.isFinite(qty) && query ? { quantity: qty, query } : {};
    },
    confidence: 0.9,
    destructive: true,
  },
  // stock.adjust: "ajuste 10 unidades do produto X" (delta positivo)
  {
    intent: "stock.adjust",
    patterns: [
      /\b(?:ajust(?:e|ar|a)|corrigir|acertar|alter(?:e|ar|a)|defin(?:a|ir)|mud(?:e|ar)|coloc(?:ar|que)|deix(?:ar|e)) (?:o )?(?:estoque|saldo) (?:do|de|em) /,
      /\b(?:ajust(?:e|ar|a)|alter(?:e|ar|a)|defin(?:a|ir)|mud(?:e|ar)|coloc(?:ar|que)|deix(?:ar|e)) (?:para|em|a) (\d+(?:[.,]\d+)?) (?:unidades?|un|pcs)? /,
      /\b(?:ajust(?:e|ar|a)|alter(?:e|ar|a)|defin(?:a|ir)|mud(?:e|ar)|coloc(?:ar|que)|deix(?:ar|e)) (?:o )?(?:estoque|saldo) (?:para|em|a) (\d+(?:[.,]\d+)?) (?:unidades?|un|pcs)? /,
    ],
    extract(text) {
      // Caso 1: "altere o estoque do produto X para 10"
      const absoluteMatch = text.match(
        /\b(?:alter(?:e|ar|a)|defin(?:a|ir)|mud(?:e|ar)|coloc(?:ar|que)|deix(?:ar|e)) (?:o )?(?:estoque|saldo) (?:do|de|em) (?:produto )?(.+?) (?:para|em|a) (\d+(?:[.,]\d+)?)/,
      );
      if (absoluteMatch) {
        const query = absoluteMatch[1].trim();
        const absolute = Number(absoluteMatch[2].replace(",", "."));
        return Number.isFinite(absolute) && query ? { absolute, query } : {};
      }

      // Caso 2: "altere o estoque para 10 do produto X"
      const absoluteMatchInv = text.match(
        /\b(?:alter(?:e|ar|a)|defin(?:a|ir)|mud(?:e|ar)|coloc(?:ar|que)|deix(?:ar|e)) (?:o )?(?:estoque|saldo) (?:para|em|a) (\d+(?:[.,]\d+)?)(?: units?| unidades?| un)? (?:do|de|em) (?:produto )?(.+)$/,
      );
      if (absoluteMatchInv) {
        const absolute = Number(absoluteMatchInv[1].replace(",", "."));
        const query = absoluteMatchInv[2].trim();
        return Number.isFinite(absolute) && query ? { absolute, query } : {};
      }

      // Caso 3: "ajuste 10 unidades do produto X" (delta)
      const deltaMatch = text.match(
        /\b(?:ajust(?:e|ar|a)|alter(?:e|ar|a)) (-?\d+(?:[.,]\d+)?) (?:unidades?|un|pcs) (?:do|de|em) (?:produto )?(.+)$/,
      );
      if (deltaMatch) {
        const delta = Number(deltaMatch[1].replace(",", "."));
        const query = deltaMatch[2].trim();
        return Number.isFinite(delta) && delta !== 0 && query ? { delta, query } : {};
      }

      return {};
    },
    confidence: 0.85,
    destructive: true,
  },

  // stock.history: "mostre o histórico do produto Essager"
  {
    intent: "stock.history",
    patterns: [
      /\b(mostr(e|ar|a)|list(e|ar|a)|ver) (o )?historico (do|de) (produto )?/,
      /\bmovimentacoes (do|de) (produto )?/,
    ],
    extract(text) {
      const m =
        text.match(/\bhistorico (?:do|de) (?:produto )?(.+)$/) ??
        text.match(/\bmovimentacoes (?:do|de) (?:produto )?(.+)$/);
      const query = m?.[1]?.trim();
      return query ? { query } : {};
    },
    confidence: 0.85,
  },
  // stock.low: "liste produtos abaixo do estoque mínimo"
  {
    intent: "stock.low",
    patterns: [
      /\b(list(e|ar|a)|mostr(e|ar|a)|ver) (produtos?|itens) (abaixo do|com) (estoque )?(minimo|mínimo|baixo|critico|crítico)\b/,
      /\bprodutos? (abaixo do|no) (minimo|mínimo|estoque minimo|estoque mínimo)\b/,
    ],
    confidence: 0.9,
  },
  // stock.balance: "qual o estoque do carregador Kaidi?"
  {
    intent: "stock.balance",
    patterns: [
      /\b(qual (o|e o|é o) )?estoque (do|de|atual do|atual de) /,
      /\bquanto (tem|ha|há) (do|de) (produto )?/,
      /\b(consultar|ver) (o )?saldo (do|de) (produto )?/,
    ],
    extract(text) {
      const m =
        text.match(/\bestoque (?:do|de|atual do|atual de) (?:produto )?(.+?)\??$/) ??
        text.match(/\bquanto (?:tem|ha|há) (?:do|de) (?:produto )?(.+?)\??$/) ??
        text.match(/\b(?:consultar|ver) (?:o )?saldo (?:do|de) (?:produto )?(.+?)\??$/);
      const query = m?.[1]?.trim();
      return query ? { query } : {};
    },
    confidence: 0.9,
  },
];

export function detectRuntimeIntent(raw: string): AgentIntent | null {
  // O detectRuntimeIntent tradicional só cuida da parte determinística.
  // Para suporte a LLM, o AgentRuntime chamará o BellaAIGateway.
  return detectDeterministicIntent(raw);
}

export function detectDeterministicIntent(raw: string): AgentIntent | null {
  const text = norm(raw ?? "");
  console.log(`[BELLA-AUDIT] normText: "${text}"`);
  if (!text) return null;


  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        const entities = rule.extract?.(text) ?? {};
        return {
          id: rule.intent,
          confidence: rule.confidence,
          entities,
          raw,
          confirmationRequired: rule.destructive ?? false,
          source: "deterministic",
        };
      }
    }
  }
  return null;
}
