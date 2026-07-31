/**
 * BaseService — utilitário mínimo para Services de negócio consumidos
 * por Skills. Injeta o cliente Supabase autenticado do ExecutionContext
 * (RLS ativa) e provê logger/metrics scoped.
 *
 * PROIBIDO: importar `supabaseAdmin` a partir de uma classe que
 * herde de BaseService. Operações privilegiadas moram em `*.server.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionContext } from "./context";
import { logger } from "./logger";
import { metrics, type Metrics } from "./metrics";

type ChildLogger = ReturnType<typeof logger.child>;

export abstract class BaseService {
  protected readonly supabase: SupabaseClient;
  protected readonly ctx: ExecutionContext;
  protected readonly log: ChildLogger;
  protected readonly metrics: Metrics = metrics;

  constructor(ctx: ExecutionContext) {
    this.ctx = ctx;
    this.supabase = ctx.supabase;
    this.log = logger.child({
      requestId: ctx.request.requestId,
      companyId: ctx.companyId,
      userId: ctx.userId,
      service: this.constructor.name,
    });
  }

  protected get companyId(): string {
    return this.ctx.companyId;
  }
}
