import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, Search, Loader2, Check } from "lucide-react";
import { RequiredLabel } from "@/components/ui/required-label";
import { useServerFn } from "@tanstack/react-start";
import { suggestFiscalCodes } from "../../../lib/fiscal-ai.functions";
import { toast } from "sonner";
import { ncmMasterService, type NcmMasterEntry } from "../../../lib/ncm-master";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { NcmSearchDialog } from "./ncm-search-dialog";
import { cn } from "@/lib/utils";

interface FiscalFormProps {
  form: any;
  setForm: (val: any) => void;
  onFiscalAutofill?: () => void;
  fiscalLoading?: boolean;
  errors?: Record<string, string>;
  categoryName?: string | null;
}

export function FiscalForm({ 
  form, 
  setForm, 
  onFiscalAutofill, 
  fiscalLoading: externalLoading,
  errors = {},
  categoryName
}: FiscalFormProps) {
  const [iaLoading, setIaLoading] = useState(false);
  const suggestFiscalFn = useServerFn(suggestFiscalCodes);
  
  // Autocomplete NCM
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  
  // O autocomplete via Popover foi removido em favor do modal de busca explícito
  // Mas mantemos a lógica de busca se necessário para o input debounced
  const [searching, setSearching] = useState(false);

  const handleAiSuggestion = async () => {
    if (!form.name) {
      toast.error("Preencha o nome do produto primeiro");
      return;
    }

    setIaLoading(true);
    try {
      const result = await suggestFiscalFn({ 
        data: { 
          productName: form.name,
          categoryName: categoryName || null
        } 
      });
      
      if (result.ncm) {
        setForm((s: any) => ({ ...s, ncm: result.ncm, cest: result.cest || s.cest }));
        toast.success("Sugestão IA aplicada!", {
          description: result.explanation
        });
      }
    } catch (error) {
      console.error("Erro na sugestão IA:", error);
      toast.error("Não foi possível obter sugestão da Bella IA");
    } finally {
      setIaLoading(false);
    }
  };

  const isLoading = iaLoading || externalLoading;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4 md:col-span-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-medium">Dados Tributários</h4>
            <p className="text-xs text-muted-foreground">Essenciais para emissão de NF-e e NFC-e.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleAiSuggestion}
            disabled={isLoading}
            className="gap-2 bg-slate-900/50 border-slate-700 hover:bg-slate-800 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            ) : (
              <Sparkles className="h-4 w-4 text-blue-500" />
            )}
            Sugestão Bella IA
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <RequiredLabel htmlFor="ncm" required>NCM (Nomenclatura Comum do Mercosul)</RequiredLabel>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="ncm"
              placeholder="00000000"
              value={form.ncm}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").substring(0, 8);
                setForm((s: any) => ({ ...s, ncm: val }));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  setSearchDialogOpen(true);
                }
              }}
              className={cn(
                "pr-10 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500",
                errors.ncm ? "border-destructive ring-destructive" : ""
              )}
            />
            <div 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer hover:text-blue-400 transition-colors" 
              onClick={() => setSearchDialogOpen(true)}
            >
              <Search className="h-4 w-4" />
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            type="button" 
            title="Buscar NCM" 
            className="shrink-0 text-slate-400 hover:text-white hover:bg-slate-800"
            onClick={() => setSearchDialogOpen(true)}
          >
            <FileText className="h-4 w-4" />
          </Button>

          <NcmSearchDialog 
            open={searchDialogOpen}
            onOpenChange={setSearchDialogOpen}
            onSelect={(ncm) => setForm((s: any) => ({ ...s, ncm }))}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Pressione Enter ou clique na lupa para buscar por descrição.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cest">CEST (Cód. Especificador da Subst. Tributária)</Label>
        <Input
          id="cest"
          placeholder="Ex: 2804000"
          value={form.cest}
          onChange={(e) => setForm((s: any) => ({ ...s, cest: e.target.value.replace(/\D/g, "") }))}
          className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
        />
        <p className="text-[10px] text-muted-foreground">Opcional, 7 dígitos.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Origem da Mercadoria</Label>
        <Input 
          disabled 
          placeholder="Nacional (0)" 
          value="0" 
          className="bg-slate-900 border-slate-800 text-slate-500"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Unidade Tributável</Label>
        <Input 
          disabled 
          value={form.unit || "UN"} 
          className="bg-slate-900 border-slate-800 text-slate-500"
        />
      </div>
    </div>
  );
}
