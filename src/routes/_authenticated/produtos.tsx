import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Package } from "lucide-react";
import { BreadcrumbNav } from "@/components/layout";
import { ActionToolbar, EntityHeader } from "@/components/design";
import {
  ProductMetrics,
  ProductFilters,
  ProductTable,
  BulkNcmDialog,
  NcmClassificationDashboard,
  useProductsList,
} from "@/features/products";
import { ProductsBellaHints } from "@/features/bella-ai";
import { ImportCsvDialog } from "@/features/products/v2/components/import-csv-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ProductListFilters } from "@/features/products";

export const Route = createFileRoute("/_authenticated/produtos")({
  beforeLoad: requirePermission("products.view"),
  component: ProductsPage,
});

const DEFAULT: ProductListFilters = {
  search: "",
  categoryId: "",
  supplierId: "",
  status: "",
  stock: "all",
  sortBy: "created_at",
  sortDir: "desc",
  page: 1,
  pageSize: 20,
  includeInactive: false,
};

function ProductsPage() {
  const { company } = Route.useRouteContext();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProductListFilters>(DEFAULT);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  const { data, isLoading } = useProductsList(company.id, effective);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <BreadcrumbNav />

      <EntityHeader
        icon={Package}
        title="Produtos"
        description="Quanto vender? Cadastre o produto e o NexOS sugere o preço ideal por canal."
        actions={
          <ActionToolbar
            createLabel="Novo produto"
            onCreate={() => navigate({ to: "/produtos/novo" })}
          >
            <BulkNcmDialog companyId={company.id} />
            <ImportCsvDialog companyId={company.id} />
          </ActionToolbar>
        }
      />

      <ProductMetrics companyId={company.id} />

      <ProductsBellaHints companyId={company.id} />

      <ProductFilters
        companyId={company.id}
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onReset={() => setFilters(DEFAULT)}
      />

      <ProductTable
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        page={filters.page}
        pageSize={filters.pageSize}
        onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
      />
      
      <NcmClassificationDashboard companyId={company.id} />
    </div>
  );
}

