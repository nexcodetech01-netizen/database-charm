import {
  UNKNOWN_ACTION_RESPONSE,
  type BellaActionContext,
  type BellaActionHandler,
  type BellaActionIntent,
  type BellaActionParser,
  type BellaActionResponse,
  type BellaActionType,
} from "./types";
import { isCancelMessage, isConfirmationMessage, keywordParser } from "./keyword-parser";
import { financeHandlers } from "./finance-handlers";
import {
  ACTION_MODULE_MAP,
  bellaContextResolver,
  bellaConversationManager,
  type BellaContextResolver,
  type BellaConversationManager,
} from "../context";
import type { BellaPendingSkill } from "../context/types";
// Carrega o SkillRegistry (registra todas as Skills no import).
// Importado dinamicamente no run() para evitar vazamento no bundle do cliente
import type { BellaSkillRegistry as SkillRegistryType } from "../skills/registry";
import type {
  BellaSkill,
  BellaSkillContext,
  BellaSkillMissingField,
  BellaSkillPayload,
  BellaSkillResult,
  BellaSkillSuggestion,
} from "../skills/types";

/**
 * BellaActionEngine
 *
 * Orquestra: contexto → resolver → parser → handler/Skill → resposta.
 *
 * Skills:
 *   - Consulta de intent → identifica Skill via parser.
 *   - Coleta multi-etapa → engine mantém `pendingSkill` em contexto,
 *     assimilando cada mensagem seguinte ao próximo campo faltante.
 *   - Confirmação → antes de executar Skills que alteram dados
 *     importantes (requiresConfirmation), pergunta ao usuário; só
 *     dispara `execute` após "sim/ok/confirma".
 *   - Cancelamento → mensagens negativas ("não", "cancela") limpam o
 *     estado pendente e devolvem uma resposta amigável.
 *
 * Toda regra de negócio permanece nos Services — a Bella apenas
 * orquestra a conversa, coleta dados e dispara a Skill correta.
 */
class BellaActionEngineImpl {
  private parser: BellaActionParser = keywordParser;
  private resolver: BellaContextResolver = bellaContextResolver;
  private manager: BellaConversationManager = bellaConversationManager;
  private handlers = new Map<BellaActionType, BellaActionHandler>();

  setParser(parser: BellaActionParser): void {
    this.parser = parser;
  }

  setResolver(resolver: BellaContextResolver): void {
    this.resolver = resolver;
  }

  setContextManager(manager: BellaConversationManager): void {
    this.manager = manager;
  }

  register(handler: BellaActionHandler): void {
    this.handlers.set(handler.action, handler);
  }

  interpret(message: string): BellaActionIntent | null {
    return this.parser.parse(message);
  }

  async run(message: string, ctx: BellaActionContext): Promise<BellaActionResponse> {
    const conversation = this.manager.get(ctx.companyId);
    const pending = conversation?.pendingSkill ?? null;
    const skillCtx: BellaSkillContext = { companyId: ctx.companyId, userId: ctx.userId ?? null };

    // 0) Existe uma Skill pendente? Trata continuação antes do parser.
    if (pending) {
      const { BellaSkillRegistry } = await import("../skills/registry" + "");
      const skill = BellaSkillRegistry.get(pending.skillId);
      if (!skill) {
        this.manager.update(ctx.companyId, { pendingSkill: null });
      } else if (pending.awaitingConfirmation) {
        if (isConfirmationMessage(message)) {
          return this.executeAndPersist(skill, pending.payload, skillCtx);
        }
        if (isCancelMessage(message)) {
          this.manager.update(ctx.companyId, { pendingSkill: null });
          return simpleResponse("Ação cancelada", "Operação cancelada. Como posso ajudar?");
        }
        // Reforça a pergunta de confirmação.
        return this.askConfirmation(skill, pending.payload, skillCtx);
      } else if (pending.awaitingField) {
        // Cancelamento explícito no meio da coleta também interrompe.
        if (isCancelMessage(message)) {
          this.manager.update(ctx.companyId, { pendingSkill: null });
          return simpleResponse("Ação cancelada", "Operação cancelada. Como posso ajudar?");
        }
        const merged = {
          ...pending.payload,
          [pending.awaitingField.field]: message.trim(),
        };
        return this.progressSkill(skill, merged, skillCtx);
      }
    }

    // 1) Parser tenta identificar Action diretamente na mensagem.
    const resolved = this.resolver.resolve(message, conversation);
    let intent = this.interpret(message);

    // 2) Fallback: continuação da última Action (leitura).
    if (!intent && resolved.continueLastAction && conversation?.lastAction) {
      intent = {
        action: conversation.lastAction,
        confidence: 0.5,
        matchedKeywords: ["__context__"],
      };
    }

    if (!intent) {
      if (resolved.moduleHint && resolved.moduleHint !== conversation?.lastModule) {
        this.manager.update(ctx.companyId, { lastModule: resolved.moduleHint });
      }
      return UNKNOWN_ACTION_RESPONSE;
    }

    // Skills — coleta + confirmação + execução.
    if (intent.action === "EXECUTE_SKILL" && intent.skillId) {
      const { BellaSkillRegistry } = await import("../skills/registry" + "");
      const skill = BellaSkillRegistry.get(intent.skillId);
      if (!skill) return UNKNOWN_ACTION_RESPONSE;
      if (!skill.canExecute(skillCtx)) {
        return simpleResponse("Permissão negada", `Você não pode executar "${skill.name}" agora.`, "high");
      }
      return this.progressSkill(skill, intent.payload ?? {}, skillCtx);
    }

    // Handlers tradicionais (leitura).
    const handler = this.handlers.get(intent.action);
    if (!handler) {
      if (resolved.moduleHint) {
        this.manager.update(ctx.companyId, { lastModule: resolved.moduleHint });
      }
      return UNKNOWN_ACTION_RESPONSE;
    }

    try {
      const response = await handler.execute(ctx);
      const actionModule =
        resolved.moduleHint ??
        (ACTION_MODULE_MAP as Partial<Record<BellaActionType, import("../providers/modules/base").BellaModuleKey>>)[intent.action] ??
        conversation?.lastModule;
      this.manager.update(ctx.companyId, {
        lastAction: intent.action,
        lastResponse: response,
        pendingSkill: null,
        ...(actionModule ? { lastModule: actionModule, lastProvider: actionModule } : {}),
      });
      return response;
    } catch {
      return UNKNOWN_ACTION_RESPONSE;
    }
  }

  /**
   * Avança uma Skill: usa `validate` (se disponível) para determinar o
   * próximo passo — pedir campo, pedir confirmação ou executar.
   * Skills sem `validate` executam diretamente (comportamento legado).
   */
  private async progressSkill(
    skill: BellaSkill,
    payload: BellaSkillPayload,
    ctx: BellaSkillContext,
  ): Promise<BellaActionResponse> {
    if (typeof skill.validate === "function") {
      const missing = skill.validate(payload, ctx);
      if (missing.length > 0) {
        return this.askField(skill, payload, missing[0], ctx);
      }
      if (skill.requiresConfirmation) {
        return this.askConfirmation(skill, payload, ctx);
      }
    }
    return this.executeAndPersist(skill, payload, ctx);
  }

  private askField(
    skill: BellaSkill,
    payload: BellaSkillPayload,
    field: BellaSkillMissingField,
    ctx: BellaSkillContext,
  ): BellaActionResponse {
    const pending: BellaPendingSkill = { skillId: skill.id, payload, awaitingField: field };
    this.manager.update(ctx.companyId, { pendingSkill: pending });
    return simpleResponse(
      "Faltam informações",
      `${field.label}?${field.hint ? ` (${field.hint})` : ""}`,
      "medium",
    );
  }

  private askConfirmation(
    skill: BellaSkill,
    payload: BellaSkillPayload,
    ctx: BellaSkillContext,
  ): BellaActionResponse {
    const pending: BellaPendingSkill = {
      skillId: skill.id,
      payload,
      awaitingConfirmation: true,
    };
    this.manager.update(ctx.companyId, { pendingSkill: pending });
    const summary =
      typeof skill.confirmationSummary === "function"
        ? skill.confirmationSummary(payload)
        : `Confirma executar "${skill.name}"?`;
    return simpleResponse(
      "Confirmar ação",
      `${summary} Responda "sim" para confirmar ou "não" para cancelar.`,
      "medium",
      [
        { id: "confirm", title: "Sim, confirmar" },
        { id: "cancel", title: "Cancelar" },
      ],
    );
  }

  private async executeAndPersist(
    skill: BellaSkill,
    payload: BellaSkillPayload,
    ctx: BellaSkillContext,
  ): Promise<BellaActionResponse> {
    const { BellaSkillRegistry } = await import("../skills/registry" + "");
    const result = await BellaSkillRegistry.execute(skill.id, payload, ctx);
    const response = skillResultToResponse(result);
    // Se ainda faltar campo após execute (ex.: Skill sem validate), continua a coleta.
    if (result.code === "missing_fields" && result.missingFields && result.missingFields.length > 0) {
      const pending: BellaPendingSkill = {
        skillId: skill.id,
        payload,
        awaitingField: result.missingFields[0],
      };
      this.manager.update(ctx.companyId, {
        pendingSkill: pending,
        lastAction: "EXECUTE_SKILL",
        lastResponse: response,
        ...(skill.module ? { lastModule: skill.module, lastProvider: skill.module } : {}),
      });
      return response;
    }
    this.manager.update(ctx.companyId, {
      pendingSkill: null,
      lastAction: "EXECUTE_SKILL",
      lastResponse: response,
      ...(skill.module ? { lastModule: skill.module, lastProvider: skill.module } : {}),
    });
    return response;
  }

}

export const BellaActionEngine = new BellaActionEngineImpl();

// Registro padrão dos handlers do módulo Financeiro.
financeHandlers.forEach((h) => BellaActionEngine.register(h));

/* ------------------- helpers ------------------- */

function simpleResponse(
  title: string,
  description: string,
  priority: BellaActionResponse["priority"] = "medium",
  suggestions: BellaActionResponse["suggestions"] = [],
): BellaActionResponse {
  return { action: "EXECUTE_SKILL", title, description, metrics: [], priority, suggestions };
}

/**
 * Converte um BellaSkillResult em BellaActionResponse — preservando
 * mensagens, prioridade e próximas ações.
 */
function skillResultToResponse(result: BellaSkillResult): BellaActionResponse {
  const suggestions = (result.suggestions ?? []).map(mapSuggestion);
  const priority = result.ok ? "medium" : result.code === "missing_fields" ? "medium" : "high";
  const title = result.ok
    ? "Ação executada"
    : result.code === "missing_fields"
      ? "Faltam informações"
      : result.code === "module_unavailable"
        ? "Módulo indisponível"
        : result.code === "not_allowed"
          ? "Permissão negada"
          : "Não foi possível executar";
  return {
    action: "EXECUTE_SKILL",
    title,
    description: result.message,
    metrics: [],
    priority,
    suggestions,
  };
}

function mapSuggestion(s: BellaSkillSuggestion) {
  return { id: s.id, title: s.title, actionLabel: s.actionLabel };
}
