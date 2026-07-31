import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout";
import {
  ProductMetrics,
  ProductFilters,
  ProductTable,
  BulkNcmDialog,
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
};

function ProductsPage() {
  const { company } = Route.useRouteContext();
  const [filters, setFilters] = useState<ProductListFilters>(DEFAULT);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  const { data, isLoading } = useProductsList(company.id, effective);

  return (
    <PageLayout
      icon={Package}
      title="Produtos"
      description="Quanto vender? Cadastre o produto e o NexOS sugere o preço ideal por canal."
      actions={
        <div className="flex items-center gap-2">
          <BulkNcmDialog companyId={company.id} />
          <ImportCsvDialog companyId={company.id} />

          <Button size="sm" asChild>
            <Link to="/produtos/novo">
              <Plus className="mr-1.5 h-4 w-4" /> Novo produto
            </Link>
          </Button>
        </div>
      }
      kpis={<ProductMetrics companyId={company.id} />}
    >
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
    </PageLayout>
  );
}
