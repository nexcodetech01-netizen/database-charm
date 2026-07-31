import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { MOVEMENT_TYPE_OPTIONS, MOVEMENT_SOURCE_OPTIONS } from "../types";
import type { MovementListFilters } from "../types";

interface Props {
  filters: MovementListFilters;
  onChange: (patch: Partial<MovementListFilters>) => void;
  onReset: () => void;
}

export function MovementFilters({ filters, onChange, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value, page: 1 })}
          placeholder="Buscar produto, motivo, observações..."
          className="pl-9"
        />
      </div>

      <Select
        value={filters.type || "all"}
        onValueChange={(v) => onChange({ type: v === "all" ? "" : v, page: 1 })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          {MOVEMENT_TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.source || "all"}
        onValueChange={(v) => onChange({ source: v === "all" ? "" : v, page: 1 })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as origens</SelectItem>
          {MOVEMENT_SOURCE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={filters.from}
        onChange={(e) => onChange({ from: e.target.value, page: 1 })}
        className="w-[160px]"
      />
      <Input
        type="date"
        value={filters.to}
        onChange={(e) => onChange({ to: e.target.value, page: 1 })}
        className="w-[160px]"
      />

      <Select
        value={`${filters.sortBy}:${filters.sortDir}`}
        onValueChange={(v) => {
          const [sortBy, sortDir] = v.split(":") as [
            MovementListFilters["sortBy"],
            MovementListFilters["sortDir"],
          ];
          onChange({ sortBy, sortDir, page: 1 });
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="movement_date:desc">Mais recentes</SelectItem>
          <SelectItem value="movement_date:asc">Mais antigas</SelectItem>
          <SelectItem value="quantity:desc">Maior quantidade</SelectItem>
          <SelectItem value="quantity:asc">Menor quantidade</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="ghost" size="sm" onClick={onReset}>
        <X className="mr-1 h-4 w-4" /> Limpar
      </Button>
    </div>
  );
}
