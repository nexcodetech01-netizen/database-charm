import { requirePermission } from "@/features/rbac";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, AlertTriangle, CheckCircle2, Loader2, RefreshCcw, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout, KpiSection, KpiCard } from "@/components/layout";
import {
  PROCESS_RECORDS,
  ProcessDetailDrawer,
  ProcessFilters,
  ProcessTable,
  type ProcessFilter,
  type ProcessRecord,
} from "@/features/processes";

export const Route = createFileRoute("/_authenticated/processamentos")({
  beforeLoad: requirePermission("settings.view"),
  component: ProcessesPage,
});

function ProcessesPage() {
  const [filter, setFilter] = useState<ProcessFilter>("all");
  const [selected, setSelected] = useState<ProcessRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rows = PROCESS_RECORDS;

  const counts = useMemo(() => {
    const base: Partial<Record<ProcessFilter, number>> = { all: rows.length };
    for (const row of rows) {
      base[row.status] = (base[row.status] ?? 0) + 1;
    }
    return base;
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return rows.filter(
      (r) =>
        r.status === "completed" && r.finishedAt && new Date(r.finishedAt).toDateString() === today,
    ).length;
  }, [rows]);

  function handleSelect(row: ProcessRecord) {
    setSelected(row);
    setDrawerOpen(true);
  }

  return (
    <PageLayout
      icon={Activity}
      title="Central de Processamentos"
      description="Acompanhe tudo que está sendo executado pelo sistema."
      actions={
        <Button variant="outline" size="sm">
          <RefreshCcw className="mr-1.5 h-4 w-4" /> Atualizar
        </Button>
      }
    >
      <KpiSection columns={4}>
        <KpiCard
          label="Em execução"
          value={counts.running ?? 0}
          icon={Loader2}
          hint="Tarefas ativas neste momento"
        />
        <KpiCard
          label="Concluídos hoje"
          value={todayCount}
          icon={CheckCircle2}
          hint="Finalizados com sucesso"
        />
        <KpiCard
          label="Falhas"
          value={counts.failed ?? 0}
          icon={AlertTriangle}
          hint="Requerem atenção"
        />
        <KpiCard
          label="Fila"
          value={(counts.queued ?? 0) + (counts.scheduled ?? 0)}
          icon={Timer}
          hint="Aguardando execução"
        />
      </KpiSection>

      <section aria-labelledby="processes-list-title" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="processes-list-title" className="text-sm font-semibold tracking-tight">
              Processamentos
            </h2>
            <p className="text-xs text-muted-foreground">
              Importações, exportações, integrações, IA, notificações, Bella Pay, marketplace e
              backups aparecem aqui em tempo real.
            </p>
          </div>
          <ProcessFilters value={filter} onChange={setFilter} counts={counts} />
        </div>

        <ProcessTable rows={filtered} onSelect={handleSelect} />
      </section>

      <ProcessDetailDrawer process={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </PageLayout>
  );
}
