import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { PageLayout } from "@/components/layout";
import { ActionToolbar } from "@/components/design";
import {
  CustomerFilters,
  CustomerMetrics,
  CustomerTable,
  useArchiveCustomer,
  useCustomersList,
  useDeleteCustomer,
  useRestoreCustomer,
} from "@/features/customers";
import type { Customer, CustomerListFilters } from "@/features/customers";
import { BellaCrmPanel } from "@/features/accounting-ai/crm";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/_authenticated/clientes")({
  beforeLoad: requirePermission("customers.view"),
  component: CustomersPage,
});

const DEFAULT: CustomerListFilters = {
  search: "",
  status: "",
  segment: "",
  state: "",
  sortBy: "created_at",
  sortDir: "desc",
  page: 1,
  pageSize: 20,
};

function CustomersPage() {
  const { company } = Route.useRouteContext();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<CustomerListFilters>(DEFAULT);
  const debounced = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debounced }),
    [filters, debounced],
  );
  const { data, isLoading } = useCustomersList(company.id, effective);

  const archiveMut = useArchiveCustomer();
  const restoreMut = useRestoreCustomer();
  const deleteMut = useDeleteCustomer();

  async function handleArchive(c: Customer) {
    try {
      await archiveMut.mutateAsync(c.id);
      toast.success(`"${c.name}" arquivado`);
    } catch (e) {
      toast.error("Não foi possível arquivar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }
  async function handleRestore(c: Customer) {
    try {
      await restoreMut.mutateAsync(c.id);
      toast.success(`"${c.name}" restaurado`);
    } catch (e) {
      toast.error("Não foi possível restaurar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }
  async function handleDelete(c: Customer) {
    if (!confirm(`Excluir permanentemente "${c.name}"?`)) return;
    try {
      await deleteMut.mutateAsync(c.id);
      toast.success("Cliente excluído");
    } catch (e) {
      toast.error("Não foi possível excluir", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <PageLayout
      icon={Users}
      title="Clientes"
      meta={`${data?.total ?? 0} cadastrados`}
      actions={
        <ActionToolbar
          onCreate={() => navigate({ to: "/clientes/novo" })}
          createLabel="Novo"
        />
      }
      kpis={null}
    >
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-8 border-b border-border bg-transparent w-full justify-start rounded-none h-auto p-0 gap-8">
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

        <TabsContent value="list" className="space-y-0 border-none p-0 outline-none">
          <CustomerFilters
            filters={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onReset={() => setFilters(DEFAULT)}
          />

          <CustomerTable
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

        <TabsContent value="insights" className="space-y-6 border-none p-0 outline-none">
          <CustomerMetrics companyId={company.id} />
          <BellaCrmPanel companyId={company.id} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
