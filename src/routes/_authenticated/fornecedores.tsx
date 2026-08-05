import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout, KpiSection, KpiCard } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  SupplierFilters,
  SupplierTable,
  useSuppliersList,
  useArchiveSupplier,
  useRestoreSupplier,
  useDeleteSupplier,
  useSupplierMetrics,
} from "@/features/suppliers";
import type { SupplierListFilters, SupplierWithMeta } from "@/features/suppliers";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  beforeLoad: requirePermission("suppliers.view"),
  component: SuppliersPage,
});

const DEFAULT: SupplierListFilters = {
  search: "",
  status: "",
  state: "",
  sortBy: "created_at",
  sortDir: "desc",
  page: 1,
  pageSize: 20,
};

function SuppliersPage() {
  const { company } = Route.useRouteContext();
  const [filters, setFilters] = useState<SupplierListFilters>(DEFAULT);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  const { data, isLoading } = useSuppliersList(company.id, effective);
  const metrics = useSupplierMetrics(company.id);

  const archiveMut = useArchiveSupplier();
  const restoreMut = useRestoreSupplier();
  const deleteMut = useDeleteSupplier();

  async function handleArchive(s: SupplierWithMeta) {
    try {
      await archiveMut.mutateAsync(s.id);
      toast.success(`"${s.name}" arquivado`);
    } catch (e) {
      toast.error("Não foi possível arquivar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }
  async function handleRestore(s: SupplierWithMeta) {
    try {
      await restoreMut.mutateAsync(s.id);
      toast.success(`"${s.name}" restaurado`);
    } catch (e) {
      toast.error("Não foi possível restaurar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }
  async function handleDelete(s: SupplierWithMeta) {
    if (s.products_count > 0) {
      toast.error("Não é possível excluir", {
        description: `Este fornecedor está vinculado a ${s.products_count} produto(s). Arquive em vez de excluir.`,
      });
      return;
    }
    if (!confirm(`Excluir permanentemente "${s.name}"?`)) return;
    try {
      await deleteMut.mutateAsync(s.id);
      toast.success("Fornecedor excluído");
    } catch (e) {
      toast.error("Não foi possível excluir", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <PageLayout
      icon={Truck}
      title="Fornecedores"
      description="Gestão de parceiros, contatos e condições comerciais."
      actions={
        <Button size="sm" asChild>
          <Link to="/fornecedores/novo">
            <Plus className="mr-1.5 h-4 w-4" /> Novo fornecedor
          </Link>
        </Button>
      }
      kpis={
        <KpiSection>
          <KpiCard
            label="Total de fornecedores"
            value={metrics.data ? formatNumber(metrics.data.total) : "—"}
            loading={metrics.isLoading}
          />
          <KpiCard
            label="Fornecedores ativos"
            value={metrics.data ? formatNumber(metrics.data.active) : "—"}
            loading={metrics.isLoading}
            highlight
          />
          <KpiCard
            label="Arquivados"
            value={metrics.data ? formatNumber(metrics.data.total - metrics.data.active) : "—"}
            loading={metrics.isLoading}
          />
        </KpiSection>
      }
    >
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list">Lista de Fornecedores</TabsTrigger>
          <TabsTrigger value="insights">Insights & IA Bella</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 border-none p-0 outline-none">
          <SupplierFilters
            filters={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onReset={() => setFilters(DEFAULT)}
          />

          <SupplierTable
            rows={data?.rows ?? []}
            total={data?.total ?? 0}
            isLoading={isLoading}
            page={filters.page}
            pageSize={filters.pageSize}
            onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4 border-none p-0 outline-none">
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Módulo de Insights para fornecedores em desenvolvimento pela Bella.</p>
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
