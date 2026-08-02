import { evaluateOfficialPrice } from "@/features/pricing/official";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpDown,
  Filter,
  Printer,
  Settings2,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiSection, KpiCard, EmptyState } from "@/components/layout";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ExportButtons } from "../components/export-buttons";
import type { Row as ExportRow } from "../utils/export";
import { productImagesService } from "@/features/products/services/product-images.service";

interface Props {
  companyId: string;
  onBack: () => void;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  status: string | null;
  stock: number;
  cost: number;
  freight: number;
  insurance: number;
  other_costs: number;
  totalCost: number;
  price: number;
  marginValue: number;
  marginPct: number;
  useCategoryMargin: boolean;
  category_id: string | null;
  categoryName: string;
  supplier_id: string | null;
  supplierName: string;
  photoUrl: string | null;
}

type ColumnKey =
  | "photo"
  | "sku"
  | "name"
  | "category"
  | "stock"
  | "cost"
  | "freight"
  | "insurance"
  | "other_costs"
  | "totalCost"
  | "marginPct"
  | "marginValue"
  | "price";

type SortKey = "name" | "sku" | "category" | "price" | "marginPct" | "marginValue";

const COLUMN_DEFS: { key: ColumnKey; label: string; align: "left" | "right" | "center" }[] = [
  { key: "photo", label: "Foto", align: "center" },
  { key: "sku", label: "SKU", align: "left" },
  { key: "name", label: "Produto", align: "left" },
  { key: "category", label: "Categoria", align: "left" },
  { key: "stock", label: "Estoque", align: "right" },
  { key: "cost", label: "Custo", align: "right" },
  { key: "freight", label: "Frete", align: "right" },
  { key: "insurance", label: "Seguro", align: "right" },
  { key: "other_costs", label: "Outros", align: "right" },
  { key: "totalCost", label: "Custo total", align: "right" },
  { key: "marginPct", label: "Margem (%)", align: "right" },
  { key: "marginValue", label: "Lucro Estimado (R$)", align: "right" },
  { key: "price", label: "Preço de venda", align: "right" },
];

const DEFAULT_COLUMNS: ColumnKey[] = [
  "photo",
  "name",
  "stock",
  "totalCost",
  "marginPct",
  "marginValue",
  "price",
];

const num = (v: unknown) => (typeof v === "number" ? v : v == null ? 0 : Number(v) || 0);

async function loadPricingData(companyId: string): Promise<ProductRow[]> {
  const [productsRes, catsRes, supsRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, sku, brand, status, stock, cost, freight, insurance, other_costs, price, margin, use_category_margin, category_id, supplier_id",
      )
      .eq("company_id", companyId)
      .order("name"),
    supabase.from("product_categories").select("id, name").eq("company_id", companyId),
    supabase.from("product_suppliers").select("id, name").eq("company_id", companyId),
  ]);
  if (productsRes.error) throw productsRes.error;

  const catMap = new Map((catsRes.data ?? []).map((c) => [c.id, c.name]));
  const supMap = new Map((supsRes.data ?? []).map((s) => [s.id, s.name]));

  const productIds = (productsRes.data ?? []).map((p) => p.id);
  const primaryPathByProduct = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: imgs } = await supabase
      .from("product_images")
      .select("product_id, path, position")
      .in("product_id", productIds)
      .order("position", { ascending: true });
    for (const img of imgs ?? []) {
      if (!primaryPathByProduct.has(img.product_id)) {
        primaryPathByProduct.set(img.product_id, img.path);
      }
    }
  }
  const paths = Array.from(new Set(primaryPathByProduct.values()));
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    try {
      const signed = await productImagesService.signedUrls(paths, 3600);
      for (const s of signed) urlByPath.set(s.path, s.signedUrl);
    } catch {
      /* ignore image errors */
    }
  }

  return (productsRes.data ?? []).map((p) => {
    const cost = num(p.cost);
    const freight = num(p.freight);
    const insurance = num(p.insurance);
    const otherCosts = num(p.other_costs);
    const price = num(p.price);
    // MOTOR ÚNICO (FASE 1/2) — relatório não calcula margem localmente.
    const evaluation = evaluateOfficialPrice(price, {
      companyId: "",
      productId: p.id,
      costs: { acquisition: cost, freight, insurance, otherCosts },
      margins: { minPct: 0, targetPct: 0 },
      module: "reports.pricing",
    });
    const totalCost = evaluation.costTotal;
    const marginValue = evaluation.profit;
    const marginPct = price > 0 ? marginValue / price : 0;

    const path = primaryPathByProduct.get(p.id);
    const photoUrl = path ? (urlByPath.get(path) ?? null) : null;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      brand: p.brand,
      status: p.status,
      stock: num(p.stock),
      cost,
      freight,
      insurance,
      other_costs: otherCosts,
      totalCost,
      price,
      marginValue,
      marginPct,
      useCategoryMargin: p.use_category_margin ?? true,
      category_id: p.category_id,
      categoryName: p.category_id ? (catMap.get(p.category_id) ?? "—") : "—",
      supplier_id: p.supplier_id,
      supplierName: p.supplier_id ? (supMap.get(p.supplier_id) ?? "—") : "—",
      photoUrl,
    };
  });
}


export function PricingReportWorkspace({ companyId, onBack }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pricing-report", companyId],
    queryFn: () => loadPricingData(companyId),
    staleTime: 60_000,
  });

  const [categoryId, setCategoryId] = useState<string>("all");
  const [supplierId, setSupplierId] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [marginMode, setMarginMode] = useState<"all" | "default" | "custom">("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((r) => {
      if (r.category_id) map.set(r.category_id, r.categoryName);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [data]);

  const suppliers = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((r) => {
      if (r.supplier_id) map.set(r.supplier_id, r.supplierName);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [data]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => r.brand && set.add(r.brand));
    return Array.from(set).sort();
  }, [data]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((r) => r.status && set.add(r.status));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (categoryId !== "all") rows = rows.filter((r) => r.category_id === categoryId);
    if (supplierId !== "all") rows = rows.filter((r) => r.supplier_id === supplierId);
    if (brand !== "all") rows = rows.filter((r) => r.brand === brand);
    if (status !== "all") rows = rows.filter((r) => r.status === status);
    if (marginMode === "default") rows = rows.filter((r) => r.useCategoryMargin);
    if (marginMode === "custom") rows = rows.filter((r) => !r.useCategoryMargin);
    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;
    if (min !== null && !Number.isNaN(min)) rows = rows.filter((r) => r.price >= min);
    if (max !== null && !Number.isNaN(max)) rows = rows.filter((r) => r.price <= max);

    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "sku":
          cmp = (a.sku ?? "").localeCompare(b.sku ?? "");
          break;
        case "category":
          cmp = a.categoryName.localeCompare(b.categoryName);
          break;
        case "price":
          cmp = a.price - b.price;
          break;
        case "marginPct":
          cmp = a.marginPct - b.marginPct;
          break;
        case "marginValue":
          cmp = a.marginValue - b.marginValue;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, categoryId, supplierId, brand, status, marginMode, priceMin, priceMax, sortKey, sortDir]);

  const totals = useMemo(() => {
    let totalCost = 0;
    let potentialRevenue = 0;
    let potentialProfit = 0;
    for (const r of filtered) {
      totalCost += r.totalCost;
      potentialRevenue += r.price;
      potentialProfit += r.marginValue;
    }
    return {
      count: filtered.length,
      totalCost,
      potentialRevenue,
      potentialProfit,
    };
  }, [filtered]);

  const activeColumns = useMemo(
    () => COLUMN_DEFS.filter((c) => visibleColumns.includes(c.key)),
    [visibleColumns],
  );

  const exportRows: ExportRow[] = useMemo(() => {
    return filtered.map((r) => {
      const out: ExportRow = {};
      for (const col of activeColumns) {
        out[col.label] = renderCellExport(r, col.key);
      }
      return out;
    });
  }, [filtered, activeColumns]);

  const clearFilters = () => {
    setCategoryId("all");
    setSupplierId("all");
    setBrand("all");
    setStatus("all");
    setMarginMode("all");
    setPriceMin("");
    setPriceMax("");
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="h-8">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Voltar
          </Button>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Relatório de Precificação</h2>
              <p className="text-sm text-muted-foreground">
                Confira a formação de preço dos produtos com custos, margem e lucro já calculados.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <ColumnPicker visible={visibleColumns} onToggle={toggleColumn} />
          <Button variant="outline" size="sm" className="h-8" onClick={() => window.print()}>
            <Printer className="mr-2 h-3.5 w-3.5" /> Imprimir
          </Button>
          <ExportButtons
            filename="precificacao"
            title="Relatório de Precificação"
            rows={exportRows}
            disabled={filtered.length === 0}
          />
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" /> Filtros
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearFilters}>
            Limpar
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <FilterField label="Categoria">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Fornecedor">
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Marca">
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Margem">
            <Select value={marginMode} onValueChange={(v) => setMarginMode(v as typeof marginMode)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="default">Padrão da categoria</SelectItem>
                <SelectItem value="custom">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Preço (R$)">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Mín"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="h-8"
              />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Máx"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="h-8"
              />
            </div>
          </FilterField>
        </CardContent>
      </Card>

      <KpiSection columns={4}>
        <KpiCard label="Produtos" value={formatNumber(totals.count)} />
        <KpiCard label="Custo total" value={formatCurrency(totals.totalCost)} />
        <KpiCard label="Valor potencial de venda" value={formatCurrency(totals.potentialRevenue)} />
        <KpiCard label="Lucro potencial" value={formatCurrency(totals.potentialProfit)} />
      </KpiSection>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="p-4 text-sm text-destructive">Falha ao carregar os dados.</p>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Nenhum produto encontrado"
              description="Ajuste os filtros para exibir a formação de preço."
              className="py-12"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    {activeColumns.map((col) => {
                      const sortable = isSortable(col.key);
                      return (
                        <TableHead
                          key={col.key}
                          className={cn(col.align === "right" && "text-right")}
                        >
                          {sortable ? (
                            <button
                              type="button"
                              onClick={() => toggleSort(col.key as SortKey)}
                              className={cn(
                                "inline-flex items-center gap-1 hover:text-foreground",
                                col.align === "right" && "ml-auto",
                              )}
                            >
                              {col.label}
                              <ArrowUpDown className="h-3 w-3 opacity-60" />
                            </button>
                          ) : (
                            col.label
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      {activeColumns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn(col.align === "right" && "text-right tabular-nums")}
                        >
                          {renderCell(r, col.key)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    {activeColumns.map((col, idx) => (
                      <TableCell
                        key={col.key}
                        className={cn(col.align === "right" && "text-right tabular-nums", "font-medium")}
                      >
                        {renderFooter(col.key, totals, idx === 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function isSortable(key: ColumnKey): boolean {
  return ["name", "sku", "category", "price", "marginPct", "marginValue"].includes(key);
}

function renderCell(r: ProductRow, key: ColumnKey): React.ReactNode {
  switch (key) {
    case "photo":
      return (
        <div className="mx-auto grid h-10 w-10 place-items-center overflow-hidden rounded-md border bg-muted">
          {r.photoUrl ? (
            <img
              src={r.photoUrl}
              alt={r.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </div>
      );
    case "sku":
      return r.sku ?? "—";
    case "name":
      return (
        <span className="inline-flex items-center gap-2">
          {r.name}
          {!r.useCategoryMargin ? (
            <Badge variant="outline" className="text-[10px]">Margem personalizada</Badge>
          ) : null}
        </span>
      );
    case "category":
      return r.categoryName;
    case "stock":
      return formatNumber(r.stock);
    case "cost":
      return formatCurrency(r.cost);
    case "freight":
      return formatCurrency(r.freight);
    case "insurance":
      return formatCurrency(r.insurance);
    case "other_costs":
      return formatCurrency(r.other_costs);
    case "totalCost":
      return formatCurrency(r.totalCost);
    case "marginPct":
      return `${(r.marginPct * 100).toFixed(1)}%`;
    case "marginValue":
      return formatCurrency(r.marginValue);
    case "price":
      return formatCurrency(r.price);
  }
}

function renderCellExport(r: ProductRow, key: ColumnKey): string | number {
  switch (key) {
    case "photo": return "";
    case "sku": return r.sku ?? "";
    case "name": return r.name;
    case "category": return r.categoryName;
    case "stock": return r.stock;
    case "cost": return r.cost;
    case "freight": return r.freight;
    case "insurance": return r.insurance;
    case "other_costs": return r.other_costs;
    case "totalCost": return r.totalCost;
    case "marginPct": return Number((r.marginPct * 100).toFixed(2));
    case "marginValue": return r.marginValue;
    case "price": return r.price;
  }
}

function renderFooter(
  key: ColumnKey,
  totals: { count: number; totalCost: number; potentialRevenue: number; potentialProfit: number },
  isFirst: boolean,
): React.ReactNode {
  if (isFirst) return `${formatNumber(totals.count)} produto${totals.count === 1 ? "" : "s"}`;
  switch (key) {
    case "totalCost":
      return formatCurrency(totals.totalCost);
    case "price":
      return formatCurrency(totals.potentialRevenue);
    case "marginValue":
      return formatCurrency(totals.potentialProfit);
    default:
      return "";
  }
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ColumnPicker({
  visible,
  onToggle,
}: {
  visible: ColumnKey[];
  onToggle: (key: ColumnKey) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Settings2 className="mr-2 h-3.5 w-3.5" /> Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Exibir colunas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COLUMN_DEFS.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.key}
            checked={visible.includes(c.key)}
            onCheckedChange={() => onToggle(c.key)}
            onSelect={(e) => e.preventDefault()}
          >
            {c.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
