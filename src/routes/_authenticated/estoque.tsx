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
  const { waitingByProduct } = useInterestSummary(company.id);

  return (
    <PageLayout
      icon={Boxes}
      title="Estoque"
      meta={`${metrics.data?.productCount ?? 0} produtos`}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild className="rounded-xl">
            <Link to="/estoque/reconciliacao">
              <Scale className="mr-1.5 h-4 w-4" /> Reconciliação
            </Link>
          </Button>
          <Button size="sm" onClick={() => setOpenForm(true)} className="rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" /> Novo
          </Button>
        </div>
      }
      kpis={null}
    >
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="mb-4 border-b border-border bg-transparent w-full justify-start rounded-none h-auto p-0 gap-8">
          <TabsTrigger 
            value="list"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-medium"
          >
            Visão Geral
          </TabsTrigger>
          <TabsTrigger 
            value="insights"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-medium"
          >
            Insights & IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MovementsTimeline
                rows={recent.data ?? []}
                isLoading={recent.isLoading}
                title="Últimas movimentações"
              />
            </div>
            <div className="space-y-6">
              <LowStockAlerts
                items={metrics.data?.belowMin ?? []}
                waitingByProduct={waitingByProduct}
              />
              <StagnantProducts items={metrics.data?.stagnant ?? []} />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">Histórico</h2>
              <MovementFilters
                filters={filters}
                onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
                onReset={() => setFilters(DEFAULT_MOVEMENT_FILTERS)}
              />
            </div>
            <MovementsTable
              rows={list.data?.rows ?? []}
              total={list.data?.total ?? 0}
              isLoading={list.isLoading}
              page={filters.page}
              pageSize={filters.pageSize}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            />
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <InventoryMetrics companyId={company.id} />
          <BellaInventoryPanel companyId={company.id} />
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
