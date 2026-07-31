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
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,180px))_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            placeholder="Nome, CPF/CNPJ, e-mail, telefone, cidade..."
            className="pl-9"
          />
        </div>

        <Select
          value={filters.status || "__all"}
          onValueChange={(v) => onChange({ status: v === "__all" ? "" : v, page: 1 })}
        >
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
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
          <SelectTrigger><SelectValue placeholder="Segmento" /></SelectTrigger>
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
          <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
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
          <SelectTrigger><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">Mais recentes</SelectItem>
            <SelectItem value="created_at:asc">Mais antigos</SelectItem>
            <SelectItem value="name:asc">Nome A→Z</SelectItem>
            <SelectItem value="name:desc">Nome Z→A</SelectItem>
            <SelectItem value="last_interaction_at:desc">Interação recente</SelectItem>
            <SelectItem value="city:asc">Cidade A→Z</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" onClick={onReset} className="justify-self-end">
          <X className="mr-1.5 h-4 w-4" /> Limpar
        </Button>
      </div>
    </div>
  );
}
