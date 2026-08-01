import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useSuppliers } from "../hooks/use-products";
import { PRODUCT_STATUS_OPTIONS, type ProductListFilters } from "../types";

interface Props {
  companyId: string;
  filters: ProductListFilters;
  onChange: (patch: Partial<ProductListFilters>) => void;
  onReset: () => void;
}

export function ProductFilters({ companyId, filters, onChange, onReset }: Props) {
  const { data: categories = [] } = useCategories(companyId);
  const { data: suppliers = [] } = useSuppliers(companyId);

  const hasFilter =
    filters.search ||
    filters.categoryId ||
    filters.supplierId ||
    filters.status ||
    filters.stock !== "all";

  return (
    <Panel density="comfortable" className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, SKU ou código de barras..."
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value, page: 1 })}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          value={filters.categoryId || "__all"}
          onValueChange={(v) => onChange({ categoryId: v === "__all" ? "" : v, page: 1 })}
        >
          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.supplierId || "__all"}
          onValueChange={(v) => onChange({ supplierId: v === "__all" ? "" : v, page: 1 })}
        >
          <SelectTrigger><SelectValue placeholder="Fornecedor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos fornecedores</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status || "__all"}
          onValueChange={(v) => onChange({ status: v === "__all" ? "" : v, page: 1 })}
        >
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos status</SelectItem>
            {PRODUCT_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.stock}
          onValueChange={(v) => onChange({ stock: v as ProductListFilters["stock"], page: 1 })}
        >
          <SelectTrigger><SelectValue placeholder="Estoque" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo estoque</SelectItem>
            <SelectItem value="in_stock">Em estoque</SelectItem>
            <SelectItem value="low">Estoque crítico</SelectItem>
            <SelectItem value="out">Sem estoque</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={`${filters.sortBy}:${filters.sortDir}`}
          onValueChange={(v) => {
            const [sortBy, sortDir] = v.split(":") as [ProductListFilters["sortBy"], ProductListFilters["sortDir"]];
            onChange({ sortBy, sortDir });
          }}
        >
          <SelectTrigger><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">Mais recentes</SelectItem>
            <SelectItem value="created_at:asc">Mais antigos</SelectItem>
            <SelectItem value="name:asc">Nome (A-Z)</SelectItem>
            <SelectItem value="name:desc">Nome (Z-A)</SelectItem>
            <SelectItem value="price:desc">Maior preço</SelectItem>
            <SelectItem value="price:asc">Menor preço</SelectItem>
            <SelectItem value="stock:desc">Maior estoque</SelectItem>
            <SelectItem value="stock:asc">Menor estoque</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilter ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Limpar filtros
          </Button>
        </div>
      ) : null}
    </div>
  );
}
