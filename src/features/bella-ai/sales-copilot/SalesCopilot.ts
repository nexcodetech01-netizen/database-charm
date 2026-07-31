/**
 * SalesCopilot — orquestrador único da venda conduzida pela Bella.
 *
 * Contrato:
 *  - Não altera Services, Providers, Skills ou Action Engine existentes.
 *  - Não duplica regra de negócio: qualquer efeito real (criar cliente,
 *    orçamento, buscar produto) passa pelo BellaSkillRegistry.
 *  - Toda continuidade conversacional passa pela Bella Memory.
 *  - O Workflow Engine acompanha as etapas quando o template estiver
 *    registrado (SalesWorkflow), sem se tornar obrigatório.
 *  - Compatível com chat interno e WhatsApp — mesma API.
 */

import { bellaMemoryManager } from "../memory/BellaMemoryManager";
import { BellaSkillRegistry } from "../skills/registry";
import type { BellaSkillContext, BellaSkillResult } from "../skills/types";
import { bellaWorkflowEngine } from "../workflows/BellaWorkflowEngine";
import { BellaWorkflowRegistry } from "../workflows/BellaWorkflowRegistry";
import { salesContextStore, type SalesContextStore } from "./SalesContext";
import { SalesValidator } from "./SalesValidator";
import { buildSummary, computeTotals } from "./SalesSummary";
import {
  salesConfirmationBus,
  SalesConfirmationBus,
} from "./SalesConfirmation";
import { ProductRecommendation } from "./ProductRecommendation";
import {
  SALES_COPILOT_WORKFLOW_ID,
  registerSalesCopilotWorkflow,
} from "./SalesWorkflow";
import type {
  SalesCopilotContext,
  SalesCopilotMetrics,
  SalesCopilotResult,
  SalesCopilotSnapshot,
  SalesLineItem,
  SalesLogEntry,
  SalesLogEvent,
  SalesProductSuggestion,
  SalesStage,
} from "./types";

function skillCtx(ctx: SalesCopilotContext): BellaSkillContext {
  return { companyId: ctx.tenantId, userId: ctx.userId };
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export class SalesCopilot {
  private logs: SalesLogEntry[] = [];
  private metrics: SalesCopilotMetrics = {
    started: 0,
    completed: 0,
    cancelled: 0,
    totalInteractions: 0,
    totalDurationMs: 0,
    skillsUsed: {},
    cancellationReasons: {},
  };
  private maxLogs = 500;

  constructor(
    private readonly store: SalesContextStore = salesContextStore,
    private readonly confirmations: SalesConfirmationBus = salesConfirmationBus,
  ) {}

  // ───────────────────── helpers internos ─────────────────────
  private log(event: SalesLogEvent, ctx: SalesCopilotContext, extra?: Partial<SalesLogEntry>): void {
    this.logs.push({
      event,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      channel: ctx.channel,
      at: Date.now(),
      ...extra,
    });
    if (this.logs.length > this.maxLogs) {
      this.logs.splice(0, this.logs.length - this.maxLogs);
    }
    this.metrics.totalInteractions += 1;
  }

  private setStage(ctx: SalesCopilotContext, stage: SalesStage): void {
    const cur = this.store.read(ctx);
    const check = SalesValidator.canTransition(cur.stage, stage);
    if (!check.ok) return;
    this.store.patch(ctx, { stage });
    this.log("stage_changed", ctx, { detail: `${cur.stage} → ${stage}` });
  }

  private buildSnapshot(ctx: SalesCopilotContext): SalesCopilotSnapshot {
    const slice = this.store.read(ctx);
    const { customer, quote } = this.store.entities(ctx);
    const totals = computeTotals(slice.items, slice.discountPercent);
    const workflow = bellaWorkflowEngine.progress({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
    });
    return {
      channel: slice.channel,
      stage: slice.stage,
      customer,
      quote,
      items: slice.items,
      discountPercent: slice.discountPercent,
      paymentMethod: slice.paymentMethod,
      notes: slice.notes,
      totals,
      workflow,
      updatedAt: slice.updatedAt,
    };
  }

  private result(
    ok: boolean,
    message: string,
    ctx: SalesCopilotContext,
    extra?: Partial<SalesCopilotResult>,
  ): SalesCopilotResult {
    return {
      ok,
      message,
      snapshot: this.buildSnapshot(ctx),
      ...extra,
    };
  }

  private async runSkill(
    ctx: SalesCopilotContext,
    skillId: string,
    payload: Record<string, unknown>,
  ): Promise<BellaSkillResult> {
    const res = await BellaSkillRegistry.execute(skillId, payload, skillCtx(ctx));
    this.metrics.skillsUsed[skillId] = (this.metrics.skillsUsed[skillId] ?? 0) + 1;
    this.log("skill_executed", ctx, {
      skillId,
      detail: res.code,
    });
    return res;
  }

  // ───────────────────── API pública ─────────────────────

  /** Descobre necessidade e inicia a jornada. Sem side-effects. */
  start(ctx: SalesCopilotContext): SalesCopilotResult {
    this.store.write(ctx, {
      channel: ctx.channel,
      stage: "discovery",
      items: [],
      discountPercent: 0,
      paymentMethod: null,
      notes: null,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      interactions: 0,
    });
    this.store.setCustomer(ctx, null);
    this.store.setQuote(ctx, null);
    this.metrics.started += 1;
    this.log("session_started", ctx);

    // Tenta registrar o Workflow oficial de venda (idempotente).
    if (!BellaWorkflowRegistry.has(SALES_COPILOT_WORKFLOW_ID)) {
      registerSalesCopilotWorkflow();
    }
    return this.result(
      true,
      "Vamos começar. Me diga o nome, telefone ou CPF/CNPJ do cliente.",
      ctx,
      {
        followUps: ["Cliente novo? Diga apenas o nome que eu cadastro."],
      },
    );
  }

  /** Encontra cliente via Skill customer.find. */
  async findCustomer(ctx: SalesCopilotContext, query: string): Promise<SalesCopilotResult> {
    if (!query.trim()) {
      return this.result(false, "Informe nome, telefone ou documento do cliente.", ctx);
    }
    this.setStage(ctx, "customer_lookup");
    const res = await this.runSkill(ctx, "customer.find", { query });
    if (res.ok) {
      const data = asRecord(res.data);
      const rows = Array.isArray(data.rows)
        ? (data.rows as Array<Record<string, unknown>>)
        : Array.isArray(res.data)
          ? (res.data as Array<Record<string, unknown>>)
          : [];
      if (rows.length === 1) {
        const row = rows[0];
        const id = typeof row.id === "string" ? row.id : "";
        const label = typeof row.name === "string" ? row.name : id;
        if (id) {
          this.store.setCustomer(ctx, { id, label, data: row });
          this.log("customer_selected", ctx, { detail: label });
          this.setStage(ctx, "product_search");
          return this.result(true, `Cliente selecionado: ${label}.`, ctx, {
            lastSkillResult: res,
          });
        }
      }
      return this.result(true, res.message, ctx, {
        lastSkillResult: res,
        followUps: rows.length
          ? [`Encontrei ${rows.length} clientes. Qual deles?`]
          : ["Nenhum cliente encontrado. Quer cadastrar?"],
      });
    }
    return this.result(false, res.message, ctx, { lastSkillResult: res });
  }

  /** Cadastra cliente via Skill customer.create. */
  async createCustomer(
    ctx: SalesCopilotContext,
    payload: Record<string, unknown>,
  ): Promise<SalesCopilotResult> {
    this.setStage(ctx, "customer_create");
    const res = await this.runSkill(ctx, "customer.create", payload);
    if (res.ok) {
      const data = asRecord(res.data);
      const id = typeof data.id === "string" ? data.id : "";
      const label = typeof data.name === "string" ? data.name : id;
      if (id) {
        this.store.setCustomer(ctx, { id, label, data });
        this.log("customer_created", ctx, { detail: label });
        this.setStage(ctx, "product_search");
      }
    }
    return this.result(res.ok, res.message, ctx, { lastSkillResult: res });
  }

  /** Recomendações usando ProductRecommendation (que reusa product.find). */
  async recommend(
    ctx: SalesCopilotContext,
    opts: { query?: string; categoryId?: string; brand?: string; minPrice?: number; maxPrice?: number },
  ): Promise<SalesProductSuggestion[]> {
    const sc = skillCtx(ctx);
    if (opts.categoryId) return ProductRecommendation.sameCategory(sc, opts.categoryId);
    if (opts.brand) return ProductRecommendation.sameBrand(sc, opts.brand);
    if (opts.minPrice !== undefined && opts.maxPrice !== undefined) {
      return ProductRecommendation.priceRange(sc, opts.minPrice, opts.maxPrice);
    }
    if (opts.query) return ProductRecommendation.similar(sc, opts.query);
    return [];
  }

  /** Adiciona item ao orçamento em memória (sem persistir ainda). */
  addItem(ctx: SalesCopilotContext, item: SalesLineItem): SalesCopilotResult {
    const { customer } = this.store.entities(ctx);
    const slice = this.store.read(ctx);
    const gate = SalesValidator.canSelectProducts(slice, customer);
    if (!gate.ok) return this.result(false, gate.reason!, ctx);
    const check = SalesValidator.canAddItem(item);
    if (!check.ok) return this.result(false, check.reason!, ctx);

    const items = [...slice.items];
    const existing = items.findIndex((i) => i.productId === item.productId);
    if (existing >= 0) {
      items[existing] = { ...items[existing], quantity: items[existing].quantity + item.quantity };
    } else {
      items.push(item);
    }
    this.store.patch(ctx, { items, stage: "quote_build" });
    this.log("product_added", ctx, { detail: item.productId });
    return this.result(true, `Adicionado: ${item.name} × ${item.quantity}.`, ctx);
  }

  removeItem(ctx: SalesCopilotContext, productId: string): SalesCopilotResult {
    const slice = this.store.read(ctx);
    const items = slice.items.filter((i) => i.productId !== productId);
    if (items.length === slice.items.length) {
      return this.result(false, "Item não encontrado no orçamento.", ctx);
    }
    this.store.patch(ctx, { items });
    this.log("product_removed", ctx, { detail: productId });
    return this.result(true, "Item removido.", ctx);
  }

  changeQuantity(ctx: SalesCopilotContext, productId: string, quantity: number): SalesCopilotResult {
    if (quantity <= 0) return this.removeItem(ctx, productId);
    const slice = this.store.read(ctx);
    const items = slice.items.map((i) =>
      i.productId === productId ? { ...i, quantity } : i,
    );
    this.store.patch(ctx, { items });
    this.log("quantity_changed", ctx, { detail: `${productId}=${quantity}` });
    return this.result(true, "Quantidade atualizada.", ctx);
  }

  applyDiscount(ctx: SalesCopilotContext, percent: number): SalesCopilotResult {
    const check = SalesValidator.canApplyDiscount(percent);
    if (!check.ok) return this.result(false, check.reason!, ctx);
    this.store.patch(ctx, { discountPercent: percent, stage: "discount" });
    this.log("discount_applied", ctx, { detail: `${percent}%` });
    return this.result(true, `Desconto de ${percent}% aplicado.`, ctx);
  }

  setPaymentMethod(ctx: SalesCopilotContext, method: string): SalesCopilotResult {
    this.store.patch(ctx, { paymentMethod: method });
    return this.result(true, `Pagamento: ${method}.`, ctx);
  }

  setNotes(ctx: SalesCopilotContext, notes: string): SalesCopilotResult {
    this.store.patch(ctx, { notes });
    return this.result(true, "Observação registrada.", ctx);
  }

  /** Monta e devolve o resumo pronto para exibição, marcando estado. */
  summary(ctx: SalesCopilotContext): SalesCopilotResult {
    const slice = this.store.read(ctx);
    const { customer } = this.store.entities(ctx);
    const gate = SalesValidator.canBuildSummary(slice, customer);
    if (!gate.ok) return this.result(false, gate.reason!, ctx);
    const summary = buildSummary({
      customer,
      items: slice.items,
      discountPercent: slice.discountPercent,
      paymentMethod: slice.paymentMethod,
    });
    this.store.patch(ctx, { stage: "summary" });
    const ticket = this.confirmations.request(ctx, summary.headline);
    this.log("summary_shown", ctx, { detail: summary.headline });
    this.log("confirmation_requested", ctx, { detail: ticket.id });
    return this.result(true, summary.headline, ctx, {
      followUps: [
        "Confirma? Responda `sim` para gerar o pedido ou `cancelar` para abortar.",
      ],
    });
  }

  /**
   * Confirma a venda. Se o Workflow oficial estiver registrado, dispara
   * `start` + `runNextStep` (o Engine chama Skills). Caso contrário,
   * chama diretamente `quote.create` — mantendo o pedido conversacional
   * funcional sem exigir infra completa de venda.
   */
  async confirm(ctx: SalesCopilotContext): Promise<SalesCopilotResult> {
    const slice = this.store.read(ctx);
    const { customer } = this.store.entities(ctx);
    const gate = SalesValidator.canConfirm(slice, customer);
    if (!gate.ok) return this.result(false, gate.reason!, ctx);

    const totals = computeTotals(slice.items, slice.discountPercent);
    this.confirmations.resolve(ctx, "confirmed");
    this.store.patch(ctx, { stage: "order_generation" });
    this.log("sale_confirmed", ctx);

    let lastSkillResult: BellaSkillResult | undefined;

    if (BellaWorkflowRegistry.has(SALES_COPILOT_WORKFLOW_ID)) {
      bellaWorkflowEngine.start({
        workflowId: SALES_COPILOT_WORKFLOW_ID,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        initialParameters: {
          customerId: customer?.id,
          customerQuery: customer?.label,
          quoteTitle: `Venda Bella · ${customer?.label ?? "cliente"}`,
          grandTotal: totals.grandTotal,
          notes: slice.notes,
        },
      });
      const step1 = await bellaWorkflowEngine.runNextStep({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      });
      lastSkillResult = step1.stepResult;
      this.log("workflow_advanced", ctx, { workflowInstanceId: step1.instance.id });
      const step2 = await bellaWorkflowEngine.runNextStep({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      });
      lastSkillResult = step2.stepResult ?? lastSkillResult;
      this.log("workflow_advanced", ctx, { workflowInstanceId: step2.instance.id });
      const stepData = asRecord(step2.stepResult?.data);
      const quoteId = typeof stepData.id === "string" ? stepData.id : null;
      if (quoteId) {
        this.store.setQuote(ctx, {
          id: quoteId,
          label: typeof stepData.title === "string" ? stepData.title : quoteId,
          data: stepData,
        });
      }
    } else {
      lastSkillResult = await this.runSkill(ctx, "quote.create", {
        title: `Venda Bella · ${customer?.label ?? "cliente"}`,
        customerId: customer?.id,
        estimatedValue: totals.grandTotal,
        description: slice.notes,
      });
      const data = asRecord(lastSkillResult.data);
      const id = typeof data.id === "string" ? data.id : null;
      if (id) {
        this.store.setQuote(ctx, {
          id,
          label: typeof data.title === "string" ? data.title : id,
          data,
        });
      }
    }

    // Estado final da conversa. Pagamento/gateway fora de escopo desta fase.
    this.store.patch(ctx, { stage: slice.paymentMethod ? "payment" : "closed" });
    this.metrics.completed += 1;
    this.metrics.totalDurationMs += Date.now() - slice.startedAt;
    this.log("session_closed", ctx);
    return this.result(true, "Venda registrada. Podemos encerrar o atendimento.", ctx, {
      lastSkillResult,
    });
  }

  /** Cancela o atendimento preservando histórico e limpando entidades. */
  cancel(ctx: SalesCopilotContext, reason?: string): SalesCopilotResult {
    const slice = this.store.read(ctx);
    this.confirmations.resolve(ctx, "declined");
    this.store.patch(ctx, { stage: "cancelled" });
    this.metrics.cancelled += 1;
    const key = reason?.trim() || "unspecified";
    this.metrics.cancellationReasons[key] = (this.metrics.cancellationReasons[key] ?? 0) + 1;
    this.metrics.totalDurationMs += Date.now() - slice.startedAt;
    this.log("sale_cancelled", ctx, { detail: reason });
    return this.result(true, "Atendimento cancelado. Nenhum pedido gerado.", ctx);
  }

  snapshot(ctx: SalesCopilotContext): SalesCopilotSnapshot {
    return this.buildSnapshot(ctx);
  }

  /** Encerra e libera memória associada ao copiloto (mantém Memory geral). */
  close(ctx: SalesCopilotContext): void {
    this.store.clear(ctx);
    this.confirmations.clear(ctx);
    this.log("session_closed", ctx);
  }

  /** Somente leitura — usado por hooks/dashboards. */
  getLogs(): readonly SalesLogEntry[] {
    return this.logs;
  }

  getMetrics(): SalesCopilotMetrics {
    const started = this.metrics.started || 0;
    const completed = this.metrics.completed || 0;
    return {
      ...this.metrics,
      // Deriva taxa média/tempo médio via helpers no hook — mantém metrics puros.
      // Retornamos apenas os agregados brutos aqui.
      started,
      completed,
    };
  }
}

// Singleton compartilhado com o resto da Bella.
export const salesCopilot = new SalesCopilot();

// Reexport para consumidores que já importam a Memory do Copilot.
export { bellaMemoryManager };
