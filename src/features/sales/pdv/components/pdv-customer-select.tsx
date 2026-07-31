import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import { salesService } from "../../services/sales.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  companyId: string;
  value: string;
  onChange: (customerId: string) => void;
};

/**
 * PDV — seleção do cliente da venda. Recolhido quando vazio (Sprint 2.9):
 * o balcão opera por padrão com consumidor final. Regras inalteradas.
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

  if (!expanded) {
    return (
      <button
        id="pdv-customer"
        type="button"
        onClick={() => {
          setExpanded(true);
          setOpen(true);
        }}
        className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">Consumidor final</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          Identificar (F2)
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Cliente</Label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Usar consumidor final"
          onClick={() => {
            onChange("");
            setExpanded(false);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Select
        open={open}
        onOpenChange={setOpen}
        value={value || undefined}
        onValueChange={onChange}
      >
        <SelectTrigger id="pdv-customer" className="h-11">
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
    </div>
  );
}
