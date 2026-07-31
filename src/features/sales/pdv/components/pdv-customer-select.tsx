import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, UserRound } from "lucide-react";
import { salesService } from "../../services/sales.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Props = {
  companyId: string;
  value: string;
  onChange: (customerId: string) => void;
};

/**
 * PDV — seleção do cliente da venda (Sprint 3.1, apenas apresentação).
 * Recolhido quando vazio: o balcão opera por padrão com consumidor final.
 * Regras e comportamento inalterados.
 */
export function PDVCustomerSelect({ companyId, value, onChange }: Props) {
  const [expanded, setExpanded] = useState(!!value);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value) setExpanded(true);
  }, [value]);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["sales", "customers", companyId],
    queryFn: () => salesService.listActiveCustomers(companyId),
    enabled: !!companyId && expanded,
  });

  const selected = customers.find((c) => c.id === value) ?? null;

  if (!expanded) {
    return (
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
            <UserRound
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Cliente
            </span>
            <span className="block truncate text-sm font-semibold">
              Consumidor Final
            </span>
          </span>
        </div>
        <Button
          id="pdv-customer"
          type="button"
          variant="outline"
          className="mt-4 h-11 w-full"
          onClick={() => {
            setExpanded(true);
            setOpen(true);
          }}
        >
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Identificar Cliente (F2)
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10">
          <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Cliente
          </span>
          <span className="block truncate text-sm font-semibold">
            {selected?.name ?? "Selecione o cliente"}
          </span>
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <Select
          open={open}
          onOpenChange={setOpen}
          value={value || undefined}
          onValueChange={onChange}
        >
          <SelectTrigger id="pdv-customer" className="h-11" aria-label="Cliente">
            <SelectValue
              placeholder={isLoading ? "Carregando..." : "Selecione o cliente"}
            />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          className="h-9 w-full text-xs text-muted-foreground"
          onClick={() => {
            onChange("");
            setExpanded(false);
          }}
        >
          Usar Consumidor Final
        </Button>
      </div>
    </div>
  );
}
