import { bellaEventEngine, type BellaEventEngine } from "./BellaEventEngine";
import type { BellaEvent, BellaRecommendation } from "./BellaEvent";
import type { BellaEventType } from "./BellaEventTypes";

/**
 * Regra declarativa que transforma um evento em uma recomendação.
 * Se `build` retornar `null`, o evento é ignorado por essa regra.
 */
interface RecommendationRule {
  eventType: BellaEventType;
  build: (event: BellaEvent) => Omit<
    BellaRecommendation,
    "id" | "eventId" | "module" | "severity" | "priority" | "createdAt"
  > | null;
}

const RULES: RecommendationRule[] = [
  // ============ Financeiro ============
  {
    eventType: "finance.invoice.overdue",
    build: () => ({
      title: "Cobrar cliente inadimplente",
      reason: "Existem cobranças vencidas gerando risco ao caixa.",
      actionLabel: "Criar cobrança automática",
      actionId: "finance.create_charge",
    }),
  },
  {
    eventType: "finance.cashflow.negative",
    build: () => ({
      title: "Revisar despesas registradas hoje",
      reason: "As saídas superaram as entradas no período.",
      actionLabel: "Abrir contas a pagar",
      actionId: "finance.review_payables",
    }),
  },
  {
    eventType: "finance.revenue.above_average",
    build: () => ({
      title: "Aproveitar o momento positivo",
      reason: "A receita está acima da média histórica.",
      actionLabel: "Analisar categorias em alta e reforçar estoque",
      actionId: "sales.analyze_top_categories",
    }),
  },
  {
    eventType: "finance.revenue.below_average",
    build: () => ({
      title: "Reagir à receita abaixo da média",
      reason: "A receita está abaixo do padrão recente.",
      actionLabel: "Ativar campanha de recuperação",
      actionId: "marketing.create_campaign",
    }),
  },
  {
    eventType: "finance.expense.out_of_pattern",
    build: () => ({
      title: "Investigar despesa incomum",
      reason: "Uma despesa está fora do padrão da categoria.",
      actionLabel: "Abrir análise da categoria de despesa",
      actionId: "finance.inspect_expense",
    }),
  },
  {
    eventType: "finance.expense.elevated",
    build: () => ({
      title: "Reduzir despesas do período",
      reason: "O total de despesas está acima do esperado.",
      actionLabel: "Priorizar cortes em contas a pagar",
      actionId: "finance.review_payables",
    }),
  },

  // ============ Clientes ============
  {
    eventType: "customers.became_delinquent",
    build: () => ({
      title: "Recuperar cliente inadimplente",
      reason: "Cliente passou a ter cobranças vencidas em aberto.",
      actionLabel: "Criar cobrança automática",
      actionId: "finance.create_charge",
    }),
  },
  {
    eventType: "customers.birthday",
    build: () => ({
      title: "Parabenizar o cliente",
      reason: "Cliente ativo está de aniversário hoje.",
      actionLabel: "Enviar mensagem personalizada",
      actionId: "marketing.send_birthday_message",
    }),
  },
  {
    eventType: "customers.returned_to_buy",
    build: () => ({
      title: "Fortalecer relacionamento",
      reason: "Cliente inativo voltou a comprar.",
      actionLabel: "Registrar follow-up e oferecer benefício",
      actionId: "crm.create_followup",
    }),
  },
  {
    eventType: "customers.vip.inactive",
    build: () => ({
      title: "Reativar cliente VIP",
      reason: "Cliente VIP está há muito tempo sem comprar.",
      actionLabel: "Enviar campanha de recuperação",
      actionId: "marketing.create_campaign",
    }),
  },

  // ============ Estoque ============
  {
    eventType: "inventory.min_stock_reached",
    build: () => ({
      title: "Repor estoque abaixo do mínimo",
      reason: "Produto atingiu o estoque mínimo configurado.",
      actionLabel: "Gerar pedido ao fornecedor",
      actionId: "purchases.create_order",
    }),
  },
  {
    eventType: "inventory.slow_moving",
    build: () => ({
      title: "Girar produto parado",
      reason: "Produto está sem giro no período monitorado.",
      actionLabel: "Sugerir campanha ou reprecificação",
      actionId: "marketing.create_campaign",
    }),
  },
  {
    eventType: "inventory.out_of_stock",
    build: () => ({
      title: "Recompor produto esgotado",
      reason: "Produto está com estoque zerado.",
      actionLabel: "Gerar pedido de urgência",
      actionId: "purchases.create_order",
    }),
  },

  // ============ Vendas ============
  {
    eventType: "sales.goal_reached",
    build: () => ({
      title: "Reconhecer a equipe",
      reason: "A meta de vendas foi atingida.",
      actionLabel: "Compartilhar resultado com a equipe",
      actionId: "sales.share_result",
    }),
  },
  {
    eventType: "sales.above_average",
    build: () => ({
      title: "Aprofundar o que está funcionando",
      reason: "As vendas superaram a média do período.",
      actionLabel: "Analisar canais e produtos em alta",
      actionId: "sales.analyze_top_categories",
    }),
  },
  {
    eventType: "sales.decline",
    build: () => ({
      title: "Reagir à queda nas vendas",
      reason: "Detectada queda relevante nas vendas.",
      actionLabel: "Analisar categorias com maior queda",
      actionId: "sales.analyze_decline",
    }),
  },
  {
    eventType: "sales.average_ticket.drop",
    build: () => ({
      title: "Reverter queda do ticket médio",
      reason: "O ticket médio caiu em relação ao padrão recente.",
      actionLabel: "Revisar mix e sugerir upsell no PDV",
      actionId: "sales.analyze_ticket",
    }),
  },
];

/**
 * BellaRecommendationEngine
 *
 * Transforma eventos em recomendações acionáveis. Escuta o `BellaEventEngine`
 * e aplica regras declarativas por tipo. Sem dependência de UI/services/skills.
 */
export class BellaRecommendationEngine {
  private recommendations: BellaRecommendation[] = [];
  private listeners = new Set<(r: BellaRecommendation) => void>();
  private unsubscribe: (() => void) | null = null;
  private seq = 0;

  constructor(private readonly engine: BellaEventEngine = bellaEventEngine) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.engine.subscribe((event) => this.process(event));
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Aplica regras a um evento avulso (útil para backfill/tests). */
  process(event: BellaEvent): BellaRecommendation[] {
    const built: BellaRecommendation[] = [];
    for (const rule of RULES) {
      if (rule.eventType !== event.type) continue;
      const partial = rule.build(event);
      if (!partial) continue;
      const rec: BellaRecommendation = {
        id: this.nextId(),
        eventId: event.id,
        module: event.module,
        severity: event.severity,
        priority: event.priority,
        createdAt: new Date(),
        ...partial,
      };
      this.recommendations.unshift(rec);
      if (this.recommendations.length > 500) this.recommendations.length = 500;
      built.push(rec);
      for (const l of this.listeners) {
        try {
          l(rec);
        } catch (err) {
          console.error("[BellaRecommendationEngine] listener falhou:", err);
        }
      }
    }
    return built;
  }

  list(): BellaRecommendation[] {
    return this.recommendations.slice();
  }

  clear(): void {
    this.recommendations = [];
  }

  subscribe(listener: (r: BellaRecommendation) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private nextId(): string {
    this.seq += 1;
    return `bella-rec-${Date.now().toString(36)}-${this.seq}`;
  }
}

/** Singleton acoplado ao `bellaEventEngine` padrão. */
export const bellaRecommendationEngine = new BellaRecommendationEngine();
