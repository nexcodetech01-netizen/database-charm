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
  CUSTOMER_SEGMENT_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  type CustomerListFilters,
} from "../types";

interface Props {
  filters: CustomerListFilters;
  onChange: (patch: Partial<CustomerListFilters>) => void;
  onReset: () => void;
}

export function CustomerFilters({ filters, onChange, onReset }: Props) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            placeholder="Buscar por nome, documento, e-mail..."
            className="pl-9 h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
          value={filters.status || "__all"}
          onValueChange={(v) => onChange({ status: v === "__all" ? "" : v, page: 1 })}
        >
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os status</SelectItem>
            {CUSTOMER_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.segment || "__all"}
          onValueChange={(v) => onChange({ segment: v === "__all" ? "" : v, page: 1 })}
        >
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Segmento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos os segmentos</SelectItem>
            {CUSTOMER_SEGMENT_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.state || "__all"}
          onValueChange={(v) => onChange({ state: v === "__all" ? "" : v, page: 1 })}
        >
          <SelectTrigger className="h-9 w-[80px]"><SelectValue placeholder="UF" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas as UFs</SelectItem>
            {BR_STATES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={`${filters.sortBy}:${filters.sortDir}`}
          onValueChange={(v) => {
            const [sortBy, sortDir] = v.split(":") as [CustomerListFilters["sortBy"], "asc" | "desc"];
            onChange({ sortBy, sortDir, page: 1 });
          }}
        >
          <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">Mais recentes</SelectItem>
            <SelectItem value="created_at:asc">Mais antigos</SelectItem>
            <SelectItem value="name:asc">Nome A→Z</SelectItem>
            <SelectItem value="name:desc">Nome Z→A</SelectItem>
            <SelectItem value="last_interaction_at:desc">Interação recente</SelectItem>
            <SelectItem value="city:asc">Cidade A→Z</SelectItem>
          </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={onReset} className="h-9 px-2 text-muted-foreground hover:text-foreground">
            <X className="mr-1.5 h-4 w-4" /> Limpar
          </Button>
        </div>
      </div>
    </div>
  );
}
