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
import {
  SALE_PAYMENT_METHODS,
  SALE_PAYMENT_STATUS_OPTIONS,
  SALE_STATUS_OPTIONS,
  type SaleListFilters,
} from "../types";

import { useActiveCustomersForSale } from "../hooks/use-sales";

interface Props {
  companyId: string;
  filters: SaleListFilters;
  onChange: (patch: Partial<SaleListFilters>) => void;
  onReset: () => void;
}

const ANY = "__any__";

export function SaleFilters({ companyId, filters, onChange, onReset }: Props) {
  const { data: customers = [] } = useActiveCustomersForSale(companyId);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <div className="relative min-w-[200px] flex-1 md:basis-64">
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
          <SelectTrigger className="md:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos os status</SelectItem>
            {SALE_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.customerId || ANY}
          onValueChange={(v) =>
            onChange({ customerId: v === ANY ? "" : v, page: 1 })
          }
        >
          <SelectTrigger className="md:w-[200px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos os clientes</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.paymentMethod || ANY}
          onValueChange={(v) =>
            onChange({ paymentMethod: v === ANY ? "" : v, page: 1 })
          }
        >
          <SelectTrigger className="md:w-[160px]">
            <SelectValue placeholder="Pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos</SelectItem>
            {SALE_PAYMENT_METHODS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.paymentStatus || ANY}
          onValueChange={(v) =>
            onChange({
              paymentStatus: (v === ANY
                ? ""
                : v) as SaleListFilters["paymentStatus"],
              page: 1,
            })
          }
        >
          <SelectTrigger className="md:w-[190px]">
            <SelectValue placeholder="Situação do pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos</SelectItem>
            {SALE_PAYMENT_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={`${filters.sortBy}:${filters.sortDir}`}
          onValueChange={(v) => {
            const [sortBy, sortDir] = v.split(":") as [
              SaleListFilters["sortBy"],
              SaleListFilters["sortDir"],
            ];
            onChange({ sortBy, sortDir, page: 1 });
          }}
        >
          <SelectTrigger className="md:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sale_date:desc">Data (recente)</SelectItem>
            <SelectItem value="sale_date:asc">Data (antiga)</SelectItem>
            <SelectItem value="paid_at:desc">Pagamento (mais recente)</SelectItem>
            <SelectItem value="paid_at:asc">Pagamento (mais antigo)</SelectItem>
            <SelectItem value="grand_total:desc">Maior valor</SelectItem>
            <SelectItem value="grand_total:asc">Menor valor</SelectItem>
            <SelectItem value="number:asc">Número (A–Z)</SelectItem>
            <SelectItem value="number:desc">Número (Z–A)</SelectItem>
          </SelectContent>
        </Select>


        <Button variant="ghost" onClick={onReset} className="shrink-0 whitespace-nowrap md:ml-auto">
          <X className="mr-1.5 h-4 w-4" /> Limpar
        </Button>
      </div>
    </div>
  );
}
