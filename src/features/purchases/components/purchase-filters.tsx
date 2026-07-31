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
import { PURCHASE_STATUS_OPTIONS, type PurchaseListFilters } from "../types";
import { useActiveSuppliersForPurchase } from "../hooks/use-purchases";

interface Props {
  companyId: string;
  filters: PurchaseListFilters;
  onChange: (patch: Partial<PurchaseListFilters>) => void;
  onReset: () => void;
}

const ANY = "__any__";

export function PurchaseFilters({ companyId, filters, onChange, onReset }: Props) {
  const { data: suppliers = [] } = useActiveSuppliersForPurchase(companyId);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_180px_220px_180px_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            placeholder="Buscar por número ou observação"
            className="pl-8"
          />
        </div>

        <Select
          value={filters.status || ANY}
          onValueChange={(v) => onChange({ status: v === ANY ? "" : v, page: 1 })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos os status</SelectItem>
            {PURCHASE_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.supplierId || ANY}
          onValueChange={(v) =>
            onChange({ supplierId: v === ANY ? "" : v, page: 1 })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Fornecedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos os fornecedores</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={`${filters.sortBy}:${filters.sortDir}`}
          onValueChange={(v) => {
            const [sortBy, sortDir] = v.split(":") as [
              PurchaseListFilters["sortBy"],
              PurchaseListFilters["sortDir"],
            ];
            onChange({ sortBy, sortDir, page: 1 });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="purchase_date:desc">Data (recente)</SelectItem>
            <SelectItem value="purchase_date:asc">Data (antiga)</SelectItem>
            <SelectItem value="grand_total:desc">Maior valor</SelectItem>
            <SelectItem value="grand_total:asc">Menor valor</SelectItem>
            <SelectItem value="number:asc">Número (A–Z)</SelectItem>
            <SelectItem value="number:desc">Número (Z–A)</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" onClick={onReset}>
          <X className="mr-1.5 h-4 w-4" /> Limpar
        </Button>
      </div>
    </div>
  );
}
