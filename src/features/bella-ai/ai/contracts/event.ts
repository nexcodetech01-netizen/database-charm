/**
 * AIInteractionEvent.v1 — audit trail emitido pelo Orchestrator.
 * Fase 1: consumido apenas por telemetria em memória (sink injetável).
 */
import type { AIIntent } from "./intent";
import type { AIResponse } from "./response";

export const EVENT_VERSION = "AIInteractionEvent.v1" as const;

export interface AIInteractionToolCall {
  readonly tool: string;
  readonly useCase: string;
  readonly durationMs: number;
  readonly error?: string;
}

export interface AIInteractionGuardrail {
  readonly rule: string;
  readonly status: "pass" | "block" | "warn";
  readonly detail?: string;
}

/**
 * Metadados de execução de Action (AI-002).
 * `actionExecuted=true` sinaliza que houve mutação via Application Layer.
 * `alreadyAudited=true` sinaliza que o Use Case já persistiu auditoria
 * append-only (ex.: RegisterPricingDecision) e o event NÃO deve duplicar.
 */
export interface AIInteractionAction {
  readonly actionId: string;
  readonly actionExecuted: boolean;
  readonly executionTimeMs: number;
  readonly useCase?: string;
  readonly alreadyAudited: boolean;
  readonly result?: unknown;
  readonly error?: string;
}

/**
 * Metadados de execução de Workflow (AI-003).
 * `alreadyAudited=true` sinaliza que o Use Case iterado (ex.: por item,
 * `RegisterPricingDecision`) já persistiu auditoria append-only.
 */
export interface AIInteractionWorkflow {
  readonly workflowId: string;
  readonly steps: number;
  readonly productsProcessed: number;
  readonly productsUpdated: number;
  readonly productsSkipped: number;
  readonly productsFailed: number;
  readonly executionTimeMs: number;
  readonly useCase?: string;
  readonly alreadyAudited: boolean;
  readonly error?: string;
}

export interface AIInteractionEvent {
  readonly version: typeof EVENT_VERSION;
  readonly traceId: string;
  readonly occurredAt: string;
  readonly userId?: string;
  readonly companyId: string;
  readonly intent: AIIntent;
  readonly toolCalls: readonly AIInteractionToolCall[];
  readonly response: AIResponse;
  readonly guardrails: readonly AIInteractionGuardrail[];
  readonly action?: AIInteractionAction;
  readonly workflow?: AIInteractionWorkflow;
}

export interface AuditSink {
  emit(event: AIInteractionEvent): void;
}

export const noopAuditSink: AuditSink = { emit: () => {} };
