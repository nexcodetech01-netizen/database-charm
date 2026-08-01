import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Boxes, Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "@/components/layout";
import {
  InventoryMetrics,
  MovementFormDialog,
  MovementsTable,
  MovementFilters,
  MovementsTimeline,
  LowStockAlerts,
  StagnantProducts,
  useMovementsList,
  useRecentMovements,
  useInventoryMetrics,
  DEFAULT_MOVEMENT_FILTERS,
} from "@/features/inventory";
import type { MovementListFilters } from "@/features/inventory";
import { BellaInventoryPanel } from "@/features/accounting-ai/inventory";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInterestSummary } from "@/features/interests";

export const Route = createFileRoute("/_authenticated/estoque")({
  beforeLoad: requirePermission("inventory.view"),
  component: InventoryPage,
});

function InventoryPage() {
  const { company } = Route.useRouteContext();
  const [openForm, setOpenForm] = useState(false);
  const [filters, setFilters] = useState<MovementListFilters>(DEFAULT_MOVEMENT_FILTERS);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const list = useMovementsList(company.id, effective);
  const recent = useRecentMovements(company.id, 8);
  const metrics = useInventoryMetrics(company.id);
  // Lista de Interesse: apenas leitura para apoiar a sugestão de compra.
  const { waitingByProduct } = useInterestSummary(company.id);

  return (
    <PageLayout
      icon={Boxes}
      title="Estoque"
      description="Quanto tenho em estoque? Acompanhe saldo, movimentações e alertas de reposição."
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/estoque/reconciliacao">
              <Scale className="mr-1.5 h-4 w-4" /> Reconciliação
            </Link>
          </Button>
          <Button size="sm" onClick={() => setOpenForm(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova movimentação
          </Button>
        </div>
      }
      kpis={<InventoryMetrics companyId={company.id} />}
    >
      <BellaInventoryPanel companyId={company.id} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MovementsTimeline
            rows={recent.data ?? []}
            isLoading={recent.isLoading}
            title="Últimas movimentações"
          />
        </div>
        <div className="space-y-4">
          <LowStockAlerts
            items={metrics.data?.belowMin ?? []}
            waitingByProduct={waitingByProduct}
          />
          <StagnantProducts items={metrics.data?.stagnant ?? []} />
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Movimentações</TabsTrigger>
          <TabsTrigger value="timeline">Timeline completa</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="space-y-4">
          <MovementFilters
            filters={filters}
            onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
            onReset={() => setFilters(DEFAULT_MOVEMENT_FILTERS)}
          />
          <MovementsTable
            rows={list.data?.rows ?? []}
            total={list.data?.total ?? 0}
            isLoading={list.isLoading}
            page={filters.page}
            pageSize={filters.pageSize}
            onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
          />
        </TabsContent>
        <TabsContent value="timeline">
          <MovementsTimeline
            rows={list.data?.rows ?? []}
            isLoading={list.isLoading}
            title="Movimentações filtradas"
          />
        </TabsContent>
      </Tabs>

      <MovementFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        companyId={company.id}
      />
    </PageLayout>
  );
}
