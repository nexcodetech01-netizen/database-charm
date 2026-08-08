import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, UserRound, RefreshCcw, User } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
      "rounded-xl border p-4 shadow-xl transition-all duration-200",
      "bg-indigo-950/40 border-indigo-500/50 backdrop-blur-sm"
    )}>
      <div className="flex flex-col gap-4">
        {/* Linha 1: Topo do Card */}
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/70">
            Cliente Selecionado
          </span>
        </div>

        {/* Linha 2: Nome Completo em Destaque */}
        <div className="min-w-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h3 className={cn(
                  "truncate text-lg font-bold leading-tight tabular-nums text-white",
                  isFinalConsumer ? "opacity-90" : "text-indigo-50"
                )}>
                  {selected?.name ?? "Consumidor Final"}
                </h3>
              </TooltipTrigger>
              <TooltipContent>
                <p>{selected?.name ?? "Consumidor Final"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Linha 3: Botões de Ação */}
        <div className="flex items-center gap-2 w-full">
          <Button
            id="pdv-customer"
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 h-9 shadow-sm bg-indigo-900/40 border-indigo-500/30 text-indigo-100 hover:bg-indigo-500 hover:text-white transition-colors"
            onClick={() => setOpen(true)}
          >
            <RefreshCcw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Trocar (F2)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1 h-9 shadow-sm bg-indigo-900/40 border-indigo-500/30 text-indigo-100 hover:bg-indigo-500 hover:text-white transition-colors"
            onClick={() => setQuickCreateOpen(true)}
          >
            <UserPlus className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            + Cadastrar
          </Button>
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

