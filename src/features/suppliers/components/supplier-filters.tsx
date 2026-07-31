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
  BR_STATES,
  SUPPLIER_STATUS_OPTIONS,
  type SupplierListFilters,
} from "../types";

interface Props {
  filters: SupplierListFilters;
  onChange: (patch: Partial<SupplierListFilters>) => void;
  onReset: () => void;
}

const ANY = "__any__";

export function SupplierFilters({ filters, onChange, onReset }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_180px_140px_180px_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            placeholder="Buscar por nome, CNPJ, contato ou e-mail"
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
            {SUPPLIER_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.state || ANY}
          onValueChange={(v) => onChange({ state: v === ANY ? "" : v, page: 1 })}
        >
          <SelectTrigger>
            <SelectValue placeholder="UF" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Todos os estados</SelectItem>
            {BR_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={`${filters.sortBy}:${filters.sortDir}`}
          onValueChange={(v) => {
            const [sortBy, sortDir] = v.split(":") as [
              SupplierListFilters["sortBy"],
              SupplierListFilters["sortDir"],
            ];
            onChange({ sortBy, sortDir, page: 1 });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">Mais recentes</SelectItem>
            <SelectItem value="created_at:asc">Mais antigos</SelectItem>
            <SelectItem value="name:asc">Nome (A–Z)</SelectItem>
            <SelectItem value="name:desc">Nome (Z–A)</SelectItem>
            <SelectItem value="city:asc">Cidade (A–Z)</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" onClick={onReset}>
          <X className="mr-1.5 h-4 w-4" /> Limpar
        </Button>
      </div>
    </div>
  );
}
