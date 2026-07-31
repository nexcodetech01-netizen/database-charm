/**
 * Bella Extension SDK — Tipos públicos
 *
 * Camada isolada que permite registrar dinamicamente Skills, Workflows,
 * Automações, Dashboards, Widgets, Insights, Menus e Rotas — sempre
 * através dos pontos de extensão já existentes. Nenhum arquivo do núcleo
 * (Services, Providers, Skills, Action Engine) é alterado.
 *
 * Toda extensão declara um `ExtensionManifest` e uma função `register`
 * que recebe um `ExtensionContext` restrito por permissões.
 */

import type { BellaSkill } from "../skills/types";
import type { BellaWorkflowDefinition } from "../workflows/BellaWorkflowTypes";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

/** SemVer simplificado: "MAJOR.MINOR.PATCH". */
export type SemVer = string;

/** Permissões declaradas explicitamente pela extensão. */
export type ExtensionPermission =
  | "read"
  | "write"
  | "execute"
  | "ai"
  | "whatsapp"
  | `module:${string}`;

export interface ExtensionCompatibility {
  /** Versão mínima do NexOS suportada. */
  minCore: SemVer;
  /** Versão máxima do NexOS suportada (opcional). */
  maxCore?: SemVer;
}

export interface ExtensionManifest {
  readonly id: string;
  readonly name: string;
  readonly version: SemVer;
  readonly author: string;
  readonly description: string;
  readonly permissions: readonly ExtensionPermission[];
  readonly dependencies?: readonly string[];
  readonly compatibility: ExtensionCompatibility;
  readonly enabled?: boolean;
}

export type ExtensionStatus =
  | "registered"
  | "installed"
  | "enabled"
  | "disabled"
  | "failed";

export interface ExtensionRecord {
  readonly manifest: ExtensionManifest;
  status: ExtensionStatus;
  installedAt: number | null;
  enabledAt: number | null;
  lastError: string | null;
}

/* ------------------------------------------------------------------ */
/* Registrable artifacts                                              */
/* ------------------------------------------------------------------ */

export interface ExtensionWidget {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly icon?: LucideIcon;
  readonly component: ComponentType<Record<string, unknown>>;
}

export interface ExtensionKpi {
  readonly id: string;
  readonly label: string;
  readonly value: string | number;
  readonly hint?: string;
}

export interface ExtensionInsight {
  readonly id: string;
  readonly title: string;
  readonly severity: "info" | "opportunity" | "warning" | "critical";
  readonly message: string;
}

export interface ExtensionDashboard {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly widgets: readonly string[];
}

export interface ExtensionMenu {
  readonly id: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly to: string;
  readonly group?: string;
}

export interface ExtensionRoute {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly component: ComponentType;
}

export interface ExtensionAutomationSpec {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly skillId: string;
  readonly payload?: Record<string, unknown>;
}

export interface ExtensionEventDetector {
  readonly id: string;
  readonly event: ExtensionLifecycleEvent | string;
  readonly handler: (payload: unknown) => void | Promise<void>;
}

export interface ExtensionTemplate {
  readonly id: string;
  readonly name: string;
  readonly kind: "message" | "workflow" | "document" | "custom";
  readonly body: string;
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                          */
/* ------------------------------------------------------------------ */

export type ExtensionLifecycleEvent =
  | "onInstall"
  | "onEnable"
  | "onDisable"
  | "onUpdate"
  | "onUninstall"
  | "onWorkflowFinished"
  | "onSkillExecuted"
  | "onAutomationExecuted"
  | "onConversationStarted"
  | "onConversationFinished";

export type ExtensionHookHandler = (payload: unknown) => void | Promise<void>;

/* ------------------------------------------------------------------ */
/* Registration surface (SDK)                                         */
/* ------------------------------------------------------------------ */

export interface ExtensionRegistrationApi {
  registerSkill(skill: BellaSkill): void;
  registerWorkflow(def: BellaWorkflowDefinition): void;
  registerAutomation(a: ExtensionAutomationSpec): void;
  registerDashboard(d: ExtensionDashboard): void;
  registerWidget(w: ExtensionWidget): void;
  registerKpi(k: ExtensionKpi): void;
  registerInsight(i: ExtensionInsight): void;
  registerMenu(m: ExtensionMenu): void;
  registerRoute(r: ExtensionRoute): void;
  registerEventDetector(d: ExtensionEventDetector): void;
  registerTemplate(t: ExtensionTemplate): void;
  on(event: ExtensionLifecycleEvent, handler: ExtensionHookHandler): void;
}

export interface Extension {
  readonly manifest: ExtensionManifest;
  register(api: ExtensionRegistrationApi, ctx: import("./ExtensionContext").ExtensionContext): void | Promise<void>;
}

export interface ExtensionLogEntry {
  timestamp: number;
  extensionId: string;
  level: "info" | "warn" | "error";
  event: string;
  message: string;
}
