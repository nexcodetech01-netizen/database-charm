/**
 * ExtensionRegistry — armazena artefatos registrados por cada extensão.
 * Mantém indexação por extensionId para permitir remoção limpa no
 * disable/uninstall sem reiniciar a aplicação.
 */
import type {
  ExtensionAutomationSpec,
  ExtensionDashboard,
  ExtensionEventDetector,
  ExtensionInsight,
  ExtensionKpi,
  ExtensionMenu,
  ExtensionRoute,
  ExtensionTemplate,
  ExtensionWidget,
} from "./types";
import type { BellaSkill } from "../skills/types";
import type { BellaWorkflowDefinition } from "../workflows/BellaWorkflowTypes";

interface Bucket {
  skills: BellaSkill[];
  workflows: BellaWorkflowDefinition[];
  automations: ExtensionAutomationSpec[];
  dashboards: ExtensionDashboard[];
  widgets: ExtensionWidget[];
  kpis: ExtensionKpi[];
  insights: ExtensionInsight[];
  menus: ExtensionMenu[];
  routes: ExtensionRoute[];
  detectors: ExtensionEventDetector[];
  templates: ExtensionTemplate[];
}

function emptyBucket(): Bucket {
  return {
    skills: [], workflows: [], automations: [], dashboards: [],
    widgets: [], kpis: [], insights: [], menus: [], routes: [],
    detectors: [], templates: [],
  };
}

class ExtensionRegistryImpl {
  private byExtension = new Map<string, Bucket>();

  ensure(extensionId: string): Bucket {
    let b = this.byExtension.get(extensionId);
    if (!b) {
      b = emptyBucket();
      this.byExtension.set(extensionId, b);
    }
    return b;
  }

  get(extensionId: string): Readonly<Bucket> | undefined {
    return this.byExtension.get(extensionId);
  }

  remove(extensionId: string): void {
    this.byExtension.delete(extensionId);
  }

  /** Snapshot agregado por tipo — leitura apenas. */
  snapshot() {
    const agg = emptyBucket();
    for (const b of this.byExtension.values()) {
      agg.skills.push(...b.skills);
      agg.workflows.push(...b.workflows);
      agg.automations.push(...b.automations);
      agg.dashboards.push(...b.dashboards);
      agg.widgets.push(...b.widgets);
      agg.kpis.push(...b.kpis);
      agg.insights.push(...b.insights);
      agg.menus.push(...b.menus);
      agg.routes.push(...b.routes);
      agg.detectors.push(...b.detectors);
      agg.templates.push(...b.templates);
    }
    return agg;
  }

  extensions(): string[] {
    return [...this.byExtension.keys()];
  }
}

export const ExtensionRegistry = new ExtensionRegistryImpl();
export type { Bucket as ExtensionArtifactBucket };
