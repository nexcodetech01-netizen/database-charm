/**
 * BaseSkill — pipeline canônico de execução de Skill.
 *
 *   validate() → permission() → confirm() → execute() → audit() → metrics()
 *
 * SEGURANÇA:
 *  - Schema Zod DEVE ser `.strict()` (bloqueia campos desconhecidos).
 *  - `execute` recebe SEMPRE o ExecutionContext autenticado.
 *  - Auditoria e log são sanitizados via `sanitizeForAudit`.
 *  - Falhas de auditoria nunca derrubam o pipeline.
 */
import type { ZodObject, ZodRawShape, ZodTypeAny, infer as ZInfer } from "zod";
import type { PermissionCode } from "@/features/rbac/lib/permission-codes";
import type { BellaSkillResult, BellaSkillMissingField } from "../../skills/types";
import { skillResult } from "../../skills/types";
import type { BellaModuleKey } from "../../providers/modules/base";
import type { ExecutionContext } from "./context";
import { logger } from "./logger";
import { metrics } from "./metrics";
import { sanitizeForAudit } from "./sanitizer";

export interface BaseSkillSpec<S extends ZodObject<ZodRawShape>, TData> {
  readonly id: string;
  readonly name: string;
  readonly module: BellaModuleKey;
  readonly description: string;
  readonly schema: S;
  readonly requiredPermissions: readonly PermissionCode[];
  readonly destructive?: boolean;
  handler(input: ZInfer<S>, ctx: ExecutionContext): Promise<BellaSkillResult<TData>>;
  confirmationSummary?(input: ZInfer<S>): string;
  prepareConfirmation?(input: ZInfer<S>, ctx: ExecutionContext): Promise<Record<string, unknown>>;
}

export interface BaseSkillRunInput<S extends ZodObject<ZodRawShape>> {
  payload: Record<string, unknown>;
  ctx: ExecutionContext;
  confirmed?: boolean;
}

export interface BaseSkill<S extends ZodObject<ZodRawShape>, TData = unknown> {
  readonly spec: BaseSkillSpec<S, TData>;
  run(input: BaseSkillRunInput<S>): Promise<BellaSkillResult<TData>>;
}

/**
 * Cria uma BaseSkill. Enforce que `schema` seja estrito via checagem
 * runtime (Zod não expõe `_def.unknownKeys` de forma pública estável,
 * então validamos rejeitando qualquer campo não declarado — que é
 * exatamente o que `.strict()` produz).
 */
export function defineBaseSkill<S extends ZodObject<ZodRawShape>, TData>(
  spec: BaseSkillSpec<S, TData>,
): BaseSkill<S, TData> {
  assertStrictSchema(spec.schema, spec.id);

  const log = logger.child({ skillId: spec.id });

  return {
    spec,
    async run({ payload, ctx, confirmed }): Promise<BellaSkillResult<TData>> {
      const startedAt = Date.now();
      const baseTags = {
        skill: spec.id,
        channel: ctx.request.channel,
        companyId: ctx.companyId,
      };

      // 1) Validação Zod estrita.
      const parsed = spec.schema.safeParse(payload);
      if (!parsed.success) {
        const missing: BellaSkillMissingField[] = parsed.error.issues.slice(0, 5).map((i) => ({
          field: String(i.path[0] ?? "input"),
          label: i.message,
          type: "text",
          required: true,
        }));
        metrics.counter("bella.skill.invalid", baseTags);
        log.warn("skill.invalid_payload", {
          requestId: ctx.request.requestId,
          companyId: ctx.companyId,
          issues: sanitizeForAudit(parsed.error.issues),
        });
        return skillResult.missing(
          "Alguns campos precisam ser corrigidos.",
          missing,
        ) as BellaSkillResult<TData>;
      }

      // 2) Permissão.
      if (!ctx.security.can(spec.requiredPermissions)) {
        metrics.counter("bella.skill.forbidden", baseTags);
        log.warn("skill.forbidden", {
          requestId: ctx.request.requestId,
          companyId: ctx.companyId,
          userId: ctx.userId,
          required: spec.requiredPermissions.join("|"),
        });
        return skillResult.notAllowed(
          `Você não tem permissão (${spec.requiredPermissions.join(" ou ")}).`,
        ) as BellaSkillResult<TData>;
      }

      // 3) Confirmação humana para operações destrutivas.
      if (spec.destructive && !confirmed) {
        const summary = spec.confirmationSummary?.(parsed.data) ?? `Confirma "${spec.name}"?`;
        const confirmationData = spec.prepareConfirmation 
          ? await spec.prepareConfirmation(parsed.data, ctx)
          : undefined;

        return {
          ok: false,
          code: "needs_confirmation",
          message: summary,
          data: confirmationData as any,
        } as BellaSkillResult<TData>;
      }

      // 4) Execução do handler.
      let result: BellaSkillResult<TData>;
      try {
        result = await spec.handler(parsed.data, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha inesperada.";
        metrics.counter("bella.skill.error", baseTags);
        log.error("skill.handler_exception", {
          requestId: ctx.request.requestId,
          companyId: ctx.companyId,
          error: message,
        });
        result = skillResult.error(message) as BellaSkillResult<TData>;
      }

      const durationMs = Date.now() - startedAt;
      metrics.timing("bella.skill.duration_ms", durationMs, baseTags);
      metrics.counter(result.ok ? "bella.skill.success" : "bella.skill.failure", baseTags);
      log.info("skill.executed", {
        requestId: ctx.request.requestId,
        companyId: ctx.companyId,
        userId: ctx.userId,
        code: result.code,
        durationMs,
      });

      return result;
    },
  };
}

function assertStrictSchema(schema: ZodTypeAny, skillId: string): void {
  // Compat zod v3 e v4:
  //  v4: `_zod.def.type === "object"` + catchall `.type === "never"`.
  //  v3: `_def.typeName === "ZodObject"` + `_def.unknownKeys === "strict"`.
  const anySchema = schema as unknown as {
    _zod?: { def?: { type?: string; catchall?: { _zod?: { def?: { type?: string } } } } };
    _def?: { typeName?: string; unknownKeys?: string };
  };
  const v4 = anySchema._zod?.def;
  const v3 = anySchema._def;

  const isObject = v4?.type === "object" || v3?.typeName === "ZodObject";
  if (!isObject) {
    throw new Error(`[BaseSkill:${skillId}] schema deve ser um ZodObject.strict().`);
  }
  const isStrict =
    v4?.catchall?._zod?.def?.type === "never" || v3?.unknownKeys === "strict";
  if (!isStrict) {
    throw new Error(
      `[BaseSkill:${skillId}] schema Zod DEVE ser .strict() — bloqueia campos desconhecidos.`,
    );
  }
}
