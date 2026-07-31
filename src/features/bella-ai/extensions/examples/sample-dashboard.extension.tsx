/**
 * Exemplo: Dashboard personalizado + Widget + Insight + KPI.
 * Demonstra registro via SDK sem tocar no núcleo.
 */
import type { Extension } from "../types";
import { defineManifest } from "../ExtensionManifest";

function SampleWidget() {
  return <div className="rounded-md border p-3 text-sm">Widget de exemplo</div>;
}

export const sampleDashboardExtension: Extension = {
  manifest: defineManifest({
    id: "example.dashboard",
    name: "Dashboard de Exemplo",
    version: "1.0.0",
    author: "NexOS",
    description: "Registra um dashboard, um widget, um KPI e um insight.",
    permissions: ["read"],
    compatibility: { minCore: "1.0.0" },
    enabled: true,
  }),
  register(api, ctx) {
    api.registerWidget({
      id: "example.widget.hello",
      title: "Olá NexOS",
      component: SampleWidget,
    });
    api.registerKpi({ id: "example.kpi.uptime", label: "Uptime", value: "99.9%" });
    api.registerInsight({
      id: "example.insight.first",
      title: "Extensão ativa",
      severity: "info",
      message: "Sua primeira extensão está funcionando.",
    });
    api.registerDashboard({
      id: "example.dashboard.overview",
      title: "Visão de Exemplo",
      widgets: ["example.widget.hello"],
    });
    api.on("onEnable", () => ctx.log("info", "dashboard de exemplo habilitado"));
  },
};
