import { useEffect, useMemo, useState } from "react";
import { BulkCostDialog } from "@/features/products/components/bulk-cost-dialog";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Calculator, ImageDown, Images, Loader2, Package, Printer, Sparkles, Tags, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { productsService } from "@/features/products/services/products.service";
import {
  labelsFromSelection,
  toggleIds,
  type LabelSelection,
} from "@/features/products/lib/label-selection";
import { BulkLabelDialog } from "@/features/printing";
import { OptimizePhotosDialog } from "@/features/products/components/optimize-photos-dialog";
import { GridCreateDialog } from "@/features/products/components/grid-create-dialog";
import { Button } from "@/components/ui/button";
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
  const [labelsOpen, setLabelsOpen] = useState(false);
  // Ferramentas de uso raro ficam no menu "Mais ações".
  const [tool, setTool] = useState<"costs" | "ncm" | "csv" | "photos" | null>(null);
  const toolProps = (id: NonNullable<typeof tool>) => ({
    open: tool === id,
    onOpenChange: (v: boolean) => setTool(v ? id : null),
  });
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  const { data, isLoading, isError, refetch } = useProductsList(company.id, effective);

  // Seleção para etiquetas: vale entre páginas; trocar o filtro limpa.
  const [selected, setSelected] = useState<LabelSelection>(new Map());
  const [selectingAll, setSelectingAll] = useState(false);
  const [printSel, setPrintSel] = useState<{ productId: string; quantity: number }[] | null>(null);
  const filterKey = JSON.stringify({ ...effective, page: 0 });
  useEffect(() => {
    setSelected(new Map());
  }, [filterKey]);
  const rowsOnPage = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageAllSelected = rowsOnPage.length > 0 && rowsOnPage.every((r) => selected.has(r.id));
  const summary = labelsFromSelection(selected);

  async function selectAllFiltered() {
    setSelectingAll(true);
    try {
      const all = await productsService.list(company.id, {
        ...effective,
        page: 1,
        pageSize: Math.min(Math.max(total, 1), 500),
      });
      setSelected((prev) => toggleIds(prev, all.rows, true));
    } catch {
      toast.error("Não foi possível selecionar todos. Tente de novo.");
    } finally {
      setSelectingAll(false);
    }
  }

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
            moreActions={[
              { label: "Preencher custos", icon: Calculator, onSelect: () => setTool("costs") },
              { label: "Preencher NCM", icon: Sparkles, onSelect: () => setTool("ncm") },
              { label: "Importar CSV", icon: Upload, onSelect: () => setTool("csv") },
              { label: "Otimizar fotos", icon: ImageDown, onSelect: () => setTool("photos") },
              {
                label: "Fotos em lote",
                icon: Images,
                onSelect: () => navigate({ to: "/produtos/fotos-em-lote" }),
              },
            ]}
          >
            <GridCreateDialog companyId={company.id} />
            <Button size="sm" variant="outline" onClick={() => setLabelsOpen(true)}>
              <Tags className="mr-1.5 h-4 w-4" /> Etiquetas em lote
            </Button>
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

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
          <span>
            <strong>{selected.size}</strong> produto(s) selecionado(s) ·{" "}
            <strong>{summary.labels}</strong> etiqueta(s)
            {summary.withoutStock > 0 ? (
              <span className="text-muted-foreground"> · {summary.withoutStock} sem estoque ficam de fora</span>
            ) : null}
          </span>
          {pageAllSelected && total > selected.size ? (
            <Button size="sm" variant="link" className="h-auto p-0" disabled={selectingAll} onClick={() => void selectAllFiltered()}>
              {selectingAll ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Selecionar todos os {Math.min(total, 500)} do filtro
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Map())}>
              <X className="mr-1.5 h-4 w-4" /> Limpar
            </Button>
            <Button size="sm" disabled={summary.labels === 0} onClick={() => setPrintSel(summary.initial)}>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimir etiquetas
            </Button>
          </div>
        </div>
      ) : null}

      <ProductTable
        selection={{
          isSelected: (id) => selected.has(id),
          toggle: (rows, checked) => setSelected((prev) => toggleIds(prev, rows, checked)),
        }}
        companyId={company.id}
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        isError={isError && !data}
        onRetry={() => void refetch()}
        page={filters.page}
        pageSize={filters.pageSize}
        onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
      />
      
      <NcmClassificationDashboard companyId={company.id} />

      <BulkCostDialog companyId={company.id} {...toolProps("costs")} />
      <BulkNcmDialog companyId={company.id} {...toolProps("ncm")} />
      <ImportCsvDialog companyId={company.id} {...toolProps("csv")} />
      <OptimizePhotosDialog companyId={company.id} {...toolProps("photos")} />

      <BulkLabelDialog open={labelsOpen} onOpenChange={setLabelsOpen} companyId={company.id} />
      <BulkLabelDialog
        open={printSel !== null}
        onOpenChange={(v) => {
          if (!v) setPrintSel(null);
        }}
        companyId={company.id}
        initial={printSel ?? []}
        title="Etiquetas dos selecionados"
      />
    </div>
  );
}

