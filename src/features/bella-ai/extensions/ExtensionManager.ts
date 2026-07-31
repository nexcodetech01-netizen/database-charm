/**
 * ExtensionManager — orquestra install/enable/disable/update/uninstall
 * e expõe a API de registro à extensão. Ponto único de entrada do SDK.
 *
 * Preserva o núcleo: não altera Services, Providers, Skills atuais nem
 * o Action Engine. Skills/Workflows registrados por extensões são
 * espelhados nos Registries oficiais existentes através da mesma API
 * pública (`BellaSkillRegistry.register`, `BellaWorkflowRegistry.register`),
 * sem duplicar regra de negócio.
 */
import type {
  Extension,
  ExtensionHookHandler,
  ExtensionLifecycleEvent,
  ExtensionLogEntry,
  ExtensionManifest,
  ExtensionRecord,
  ExtensionRegistrationApi,
} from "./types";
import { validateManifest } from "./ExtensionValidator";
import { ExtensionRegistry } from "./ExtensionRegistry";
import { createExtensionContext } from "./ExtensionContext";
import { ExtensionLifecycleBus } from "./ExtensionLifecycle";
import { loadExtension, type ExtensionSource } from "./ExtensionLoader";
import { compareSemVer } from "./ExtensionManifest";
import { BellaSkillRegistry } from "../skills/registry";
import { BellaWorkflowRegistry } from "../workflows/BellaWorkflowRegistry";

const CORE_VERSION = "1.0.0";
const MAX_LOG = 500;

class ExtensionManagerImpl {
  private records = new Map<string, ExtensionRecord>();
  private extensions = new Map<string, Extension>();
  private bus = new ExtensionLifecycleBus();
  private logs: ExtensionLogEntry[] = [];

  /** Registra e instala uma extensão. Não a habilita. */
  async install(source: ExtensionSource): Promise<ExtensionRecord> {
    const ext = await loadExtension(source);
    const manifest = ext.manifest;

    const validation = validateManifest(manifest, {
      coreVersion: CORE_VERSION,
      installedIds: new Set(this.records.keys()),
    });
    if (!validation.ok) {
      const message = validation.errors.join("; ");
      this.appendLog(manifest.id, "error", "install", message);
      throw new Error(`[ExtensionManager] install "${manifest.id}" inválido: ${message}`);
    }

    const record: ExtensionRecord = {
      manifest,
      status: "installed",
      installedAt: Date.now(),
      enabledAt: null,
      lastError: null,
    };
    this.records.set(manifest.id, record);
    this.extensions.set(manifest.id, ext);
    this.appendLog(manifest.id, "info", "install", `v${manifest.version} instalada.`);
    await this.bus.emit("onInstall", { extensionId: manifest.id });

    if (manifest.enabled) await this.enable(manifest.id);
    return record;
  }

  async enable(id: string): Promise<void> {
    const record = this.mustGetRecord(id);
    if (record.status === "enabled") return;
    const ext = this.extensions.get(id)!;

    const api = this.buildRegistrationApi(id);
    const ctx = createExtensionContext({
      manifest: record.manifest,
      log: (level, message) => this.appendLog(id, level, "runtime", message),
    });

    try {
      await ext.register(api, ctx);
      record.status = "enabled";
      record.enabledAt = Date.now();
      record.lastError = null;
      this.appendLog(id, "info", "enable", "extensão habilitada.");
      await this.bus.emit("onEnable", { extensionId: id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro ao habilitar";
      record.status = "failed";
      record.lastError = message;
      this.appendLog(id, "error", "enable", message);
      this.teardown(id);
      throw err;
    }
  }

  async disable(id: string): Promise<void> {
    const record = this.mustGetRecord(id);
    if (record.status !== "enabled") return;
    this.teardown(id);
    record.status = "disabled";
    record.enabledAt = null;
    this.appendLog(id, "info", "disable", "extensão desativada.");
    await this.bus.emit("onDisable", { extensionId: id });
  }

  async update(source: ExtensionSource): Promise<ExtensionRecord> {
    const ext = await loadExtension(source);
    const id = ext.manifest.id;
    const existing = this.records.get(id);
    if (!existing) return this.install(source);

    const cmp = compareSemVer(ext.manifest.version, existing.manifest.version);
    if (cmp <= 0) {
      throw new Error(
        `[ExtensionManager] update rejeitado: ${ext.manifest.version} não é maior que ${existing.manifest.version}.`,
      );
    }
    const wasEnabled = existing.status === "enabled";
    if (wasEnabled) await this.disable(id);
    this.records.delete(id);
    this.extensions.delete(id);
    const record = await this.install(source);
    this.appendLog(id, "info", "update", `atualizada para v${ext.manifest.version}.`);
    await this.bus.emit("onUpdate", { extensionId: id, version: ext.manifest.version });
    if (wasEnabled) await this.enable(id);
    return record;
  }

  async uninstall(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    if (record.status === "enabled") await this.disable(id);
    this.records.delete(id);
    this.extensions.delete(id);
    this.appendLog(id, "info", "uninstall", "extensão removida.");
    await this.bus.emit("onUninstall", { extensionId: id });
  }

  /* ----------------------------- Query ---------------------------- */

  list(): ExtensionRecord[] {
    return [...this.records.values()];
  }
  get(id: string): ExtensionRecord | undefined {
    return this.records.get(id);
  }
  getLogs(id?: string): ExtensionLogEntry[] {
    return id ? this.logs.filter((l) => l.extensionId === id) : [...this.logs];
  }

  /** Emissão de eventos de runtime pelo núcleo (opcional). */
  async emit(event: ExtensionLifecycleEvent | string, payload?: unknown): Promise<void> {
    await this.bus.emit(event, payload);
  }

  /* ----------------------------- Internals ------------------------ */

  private buildRegistrationApi(extensionId: string): ExtensionRegistrationApi {
    const bucket = ExtensionRegistry.ensure(extensionId);
    const manifest = this.records.get(extensionId)!.manifest;
    const perms = new Set(manifest.permissions);
    const bus = this.bus;

    const requirePermission = (perm: string, label: string) => {
      if (!perms.has(perm as never)) {
        throw new Error(`[ExtensionManager] "${extensionId}" precisa da permissão "${perm}" para ${label}.`);
      }
    };

    return {
      registerSkill: (skill) => {
        requirePermission("execute", "registrar Skill");
        if (BellaSkillRegistry.has(skill.id)) {
          throw new Error(`[ExtensionManager] Skill "${skill.id}" já registrada no núcleo.`);
        }
        BellaSkillRegistry.register(skill);
        bucket.skills.push(skill);
      },
      registerWorkflow: (def) => {
        requirePermission("execute", "registrar Workflow");
        BellaWorkflowRegistry.register(def);
        bucket.workflows.push(def);
      },
      registerAutomation: (a) => {
        requirePermission("execute", "registrar Automação");
        bucket.automations.push(a);
      },
      registerDashboard: (d) => bucket.dashboards.push(d),
      registerWidget: (w) => bucket.widgets.push(w),
      registerKpi: (k) => bucket.kpis.push(k),
      registerInsight: (i) => bucket.insights.push(i),
      registerMenu: (m) => bucket.menus.push(m),
      registerRoute: (r) => bucket.routes.push(r),
      registerEventDetector: (d) => {
        bucket.detectors.push(d);
        bus.on(d.event, extensionId, d.handler);
      },
      registerTemplate: (t) => bucket.templates.push(t),
      on: (event, handler: ExtensionHookHandler) => bus.on(event, extensionId, handler),
    };
  }

  /** Remove todos os artefatos e handlers registrados pela extensão. */
  private teardown(id: string): void {
    const bucket = ExtensionRegistry.get(id);
    if (bucket) {
      // Skills/Workflows não têm unregister público — não removemos do núcleo
      // para não mexer em contratos existentes. Registramos apenas no bucket
      // da extensão; para versões futuras, expor unregister nos Registries.
      // Aqui limpamos o snapshot da extensão:
      ExtensionRegistry.remove(id);
    }
    this.bus.offAll(id);
  }

  private mustGetRecord(id: string): ExtensionRecord {
    const r = this.records.get(id);
    if (!r) throw new Error(`[ExtensionManager] extensão "${id}" não encontrada.`);
    return r;
  }

  private appendLog(
    extensionId: string,
    level: ExtensionLogEntry["level"],
    event: string,
    message: string,
  ): void {
    this.logs.push({ timestamp: Date.now(), extensionId, level, event, message });
    if (this.logs.length > MAX_LOG) this.logs.splice(0, this.logs.length - MAX_LOG);
  }

  /** Somente para testes. */
  __resetAll(): void {
    for (const id of [...this.records.keys()]) this.teardown(id);
    this.records.clear();
    this.extensions.clear();
    this.logs = [];
  }
}

export const ExtensionManager = new ExtensionManagerImpl();
export { CORE_VERSION as EXTENSION_CORE_VERSION };
export type { ExtensionManifest };
