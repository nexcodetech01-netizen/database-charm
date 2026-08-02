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
      <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
        <UserRound
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          Consumidor Final
        </span>
        <Button
          id="pdv-customer"
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={() => {
            setExpanded(true);
            setOpen(true);
          }}
        >
          <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Cliente (F2)
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <UserRound className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 truncate text-sm font-semibold">
          {selected?.name ?? "Selecione o cliente"}
        </span>
      </div>

      <div className="mt-2 space-y-1.5">
        <Select
          open={open}
          onOpenChange={setOpen}
          value={value || undefined}
          onValueChange={onChange}
        >
          <SelectTrigger id="pdv-customer" className="h-9" aria-label="Cliente">
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
          className="h-8 w-full text-xs text-muted-foreground"
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
