import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NfeStatus } from "../functions/fiscal.functions";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Rascunho" },
  { value: "authorized", label: "Autorizadas" },
  { value: "sending", label: "Em envio" },
  { value: "rejected", label: "Rejeitadas" },
  { value: "cancelled", label: "Canceladas" },
  { value: "error", label: "Com erro" },
  { value: "discarded", label: "Descartadas" },
];

export interface FiscalFiltersProps {
  status: string;
  onStatusChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

export function FiscalFilters({
  status,
  onStatusChange,
  search,
  onSearchChange,
}: FiscalFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Buscar por chave de acesso ou protocolo…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-md"
      />
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function isValidStatusFilter(v: string): v is NfeStatus | "all" {
  return STATUS_OPTIONS.some((o) => o.value === v);
}
