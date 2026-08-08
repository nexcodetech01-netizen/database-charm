import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, UserRound, RefreshCcw, User, Search, Check } from "lucide-react";
import { salesService } from "../../services/sales.service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["sales", "customers", companyId],
    queryFn: () => salesService.listActiveCustomers(companyId),
    enabled: !!companyId,
  });

  const filteredCustomers = customers.filter((c) =>
    [c.name, c.document, c.phone].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  const options = [{ id: "none", name: "Consumidor Final" }, ...filteredCustomers];

  useEffect(() => {
    if (open) {
      setSearch("");
      setActiveIndex(0);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selectedOption = options[activeIndex];
      if (selectedOption) {
        onChange(selectedOption.id === "none" ? "" : selectedOption.id);
        setOpen(false);
      }
    }
  };

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

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden bg-indigo-950 border-indigo-500/50 text-white">
            <DialogHeader className="p-4 border-b border-indigo-500/30">
              <DialogTitle className="text-xl font-bold text-indigo-50">
                Selecionar Cliente para a Venda
              </DialogTitle>
            </DialogHeader>
            <div className="p-4 bg-indigo-900/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400" />
                <Input
                  ref={searchInputRef}
                  placeholder="Digite o nome, CPF ou telefone..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  className="pl-10 h-12 bg-indigo-950/50 border-indigo-500/30 focus-visible:ring-indigo-500 text-white placeholder:text-indigo-400/50"
                />
              </div>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="p-2 space-y-1">
                {options.map((opt, index) => {
                  const isSelected = value === opt.id || (opt.id === "none" && !value);
                  const isActive = index === activeIndex;

                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        onChange(opt.id === "none" ? "" : opt.id);
                        setOpen(false);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all duration-200",
                        isActive ? "bg-indigo-600 text-white shadow-lg scale-[1.02]" : "hover:bg-indigo-800/50 text-indigo-100",
                        isSelected && !isActive && "text-indigo-400"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full",
                          isActive ? "bg-white/20" : "bg-indigo-900/50"
                        )}>
                          {opt.id === "none" ? (
                            <UserRound className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm leading-tight">
                            {opt.name}
                          </p>
                          {opt.id !== "none" && (customers.find(c => c.id === opt.id)?.document || customers.find(c => c.id === opt.id)?.phone) && (
                            <p className={cn(
                              "text-[10px] mt-0.5 opacity-60",
                              isActive ? "text-white" : "text-indigo-300"
                            )}>
                              {customers.find(c => c.id === opt.id)?.document} {customers.find(c => c.id === opt.id)?.phone && `• ${customers.find(c => c.id === opt.id)?.phone}`}
                            </p>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className={cn("h-4 w-4", isActive ? "text-white" : "text-indigo-400")} />
                      )}
                    </button>
                  );
                })}
                {options.length === 0 && (
                  <div className="py-8 text-center text-indigo-400/50 text-sm">
                    Nenhum cliente encontrado
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="p-3 bg-indigo-950 border-t border-indigo-500/30 flex justify-between items-center text-[10px] text-indigo-400/70 font-medium">
              <div className="flex gap-3">
                <span><kbd className="bg-indigo-900 px-1.5 py-0.5 rounded border border-indigo-500/30 text-indigo-200">↑↓</kbd> Navegar</span>
                <span><kbd className="bg-indigo-900 px-1.5 py-0.5 rounded border border-indigo-500/30 text-indigo-200">ENTER</kbd> Selecionar</span>
              </div>
              <span><kbd className="bg-indigo-900 px-1.5 py-0.5 rounded border border-indigo-500/30 text-indigo-200">ESC</kbd> Fechar</span>
            </div>
          </DialogContent>
        </Dialog>
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

