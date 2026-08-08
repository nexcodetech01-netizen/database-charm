import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, UserRound, RefreshCcw } from "lucide-react";
import { salesService } from "../../services/sales.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PDVCustomerQuickCreate } from "@/features/customers/components/customer-quick-create";

type Props = {
  companyId: string;
  value: string;
  onChange: (customerId: string) => void;
};

/**
 * PDV — seleção do cliente da venda (Sprint 8.4 - Enterprise UI).
 * Card em destaque com opções de troca rápida e cadastro sem sair da venda.
 */
export function PDVCustomerSelect({ companyId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["sales", "customers", companyId],
    queryFn: () => salesService.listActiveCustomers(companyId),
    enabled: !!companyId,
  });

  const selected = customers.find((c) => c.id === value) ?? null;
  const isFinalConsumer = !value || !selected;

  return (
    <div className={cn(
      "rounded-xl border p-4 shadow-sm transition-all duration-200",
      isFinalConsumer 
        ? "bg-muted/30 border-border" 
        : "bg-primary/5 border-primary/30 ring-1 ring-primary/10"
    )}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm",
              isFinalConsumer ? "bg-background text-muted-foreground" : "bg-primary text-primary-foreground border-primary"
            )}>
              <UserRound className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Cliente da Venda
              </span>
              <h3 className={cn(
                "truncate text-lg leading-tight tabular-nums",
                isFinalConsumer ? "font-medium text-foreground/80" : "font-bold text-foreground"
              )}>
                {selected?.name ?? "Consumidor Final"}
              </h3>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Button
              id="pdv-customer"
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shadow-sm bg-background hover:bg-primary/5 hover:text-primary hover:border-primary/30"
              onClick={() => setOpen(true)}
            >
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Trocar (F2)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shadow-sm bg-background hover:bg-primary/5 hover:text-primary hover:border-primary/30"
              onClick={() => setQuickCreateOpen(true)}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Cadastrar
            </Button>
          </div>
        </div>

        <Select
          open={open}
          onOpenChange={setOpen}
          value={value || undefined}
          onValueChange={onChange}
        >
          <SelectTrigger className="hidden" aria-hidden="true" />
          <SelectContent className="max-h-[300px]">
            <SelectItem value="none" className="font-semibold text-primary">
              Consumidor Final
            </SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!isFinalConsumer && (
          <Button
            type="button"
            variant="ghost"
            className="h-7 w-fit px-2 text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive"
            onClick={() => onChange("")}
          >
            Remover cliente / Consumidor Final
          </Button>
        )}
      </div>

      <PDVCustomerQuickCreate
        companyId={companyId}
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onSaved={(c) => onChange(c.id)}
      />
    </div>
  );
}

