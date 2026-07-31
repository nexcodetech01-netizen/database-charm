/**
 * ToolDefinition.v1 — 1 Tool = 1 Use Case (Application Layer).
 * Fase 1 read-only: nenhuma tool `mutating`.
 */
import { z } from "zod";
import type { SupportedIntent } from "./intent";

export const TOOL_VERSION = "ToolDefinition.v1" as const;

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  readonly version: typeof TOOL_VERSION;
  readonly name: string;
  readonly intent: SupportedIntent;
  readonly description: string;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema: z.ZodType<TOutput>;
  /** Nome estável do Use Case orquestrado (audit + citação). */
  readonly useCase: string;
  readonly mutating: false; // Fase 1 é read-only por contrato de tipo.
  readonly needsApproval: false;
  readonly scopes: readonly string[];
  /** Executor injetável — em produção chama o server function; em teste, mock. */
  execute(input: TInput, ctx: ToolExecContext): Promise<TOutput>;
}

export interface ToolExecContext {
  readonly companyId: string;
  readonly userId?: string;
  readonly traceId: string;
}

export interface ToolInvocationResult<TOutput = unknown> {
  readonly tool: string;
  readonly useCase: string;
  readonly output: TOutput;
  readonly durationMs: number;
  readonly traceId: string;
}
