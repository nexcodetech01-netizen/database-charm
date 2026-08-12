import { useState, useEffect } from "react";
import { Search, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ncmMasterService, type NcmMasterEntry } from "../../../lib/ncm-master";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface NcmSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (ncm: string) => void;
}

export function NcmSearchDialog({ open, onOpenChange, onSelect }: NcmSearchDialogProps) {
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebouncedValue(searchValue, 300);
  const [searchResults, setSearchResults] = useState<NcmMasterEntry[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    async function performSearch() {
      if (debouncedSearch.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await ncmMasterService.search(debouncedSearch);
        setSearchResults(results);
      } catch (error) {
        console.error("Erro na busca de NCM:", error);
      } finally {
        setSearching(false);
      }
    }
    performSearch();
  }, [debouncedSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Busca de NCM</DialogTitle>
          <DialogDescription>
            Pesquise por código ou descrição (ex: "capa", "cabo", "vidro").
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-0">
          <Command shouldFilter={false} className="rounded-none border-none">
            <CommandInput 
              placeholder="Digite para buscar..." 
              value={searchValue}
              onValueChange={setSearchValue}
              className="h-12 border-none ring-0 focus:ring-0"
            />
            <CommandList className="max-h-[350px]">
              <CommandEmpty className="py-6 text-center text-sm">
                {searching ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span>Buscando NCMs...</span>
                  </div>
                ) : (
                  searchValue.length < 2 ? "Digite pelo menos 2 caracteres." : "Nenhum NCM encontrado."
                )}
              </CommandEmpty>
              <CommandGroup>
                {searchResults.map((item) => (
                  <CommandItem
                    key={`${item.ncm}-${item.description}`}
                    value={item.ncm}
                    onSelect={() => {
                      onSelect(item.ncm);
                      onOpenChange(false);
                    }}
                    className="flex flex-col items-start gap-1 py-3 px-6 cursor-pointer hover:bg-slate-100"
                  >
                    <div className="flex items-center w-full justify-between">
                      <span className="font-bold text-blue-600">{item.ncm}</span>
                      <Search className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </DialogContent>
    </Dialog>
  );
}
