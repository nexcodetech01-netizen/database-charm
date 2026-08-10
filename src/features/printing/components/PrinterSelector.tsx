import React from 'react';
import { Printer, PrinterCategory } from '../types/printing.types';
import { printerService } from '../services/printer.service';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Monitor, Printer as PrinterIcon } from 'lucide-react';

interface PrinterSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
}

const CATEGORY_ORDER: PrinterCategory[] = ['Etiquetas', 'Cupom', 'PDF', 'Outras'];

export const PrinterSelector: React.FC<PrinterSelectorProps> = ({ value, onValueChange }) => {
  const [printers, setPrintersState] = React.useState<Printer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [bridgeUnavailable, setBridgeUnavailable] = React.useState(false);

  // Instrumentação do estado printers
  const setPrinters = React.useCallback((newPrinters: Printer[], origem: string) => {
    const timestamp = new Date().toISOString();
    console.group(`[PrinterSelector] [${timestamp}] setPrinters chamado`);
    console.log(`Origem: ${origem}`);
    console.log("Estado anterior printers:", printers);
    console.log("Novos printers a definir:", newPrinters);
    console.trace("Stack trace da chamada setPrinters");
    
    // Regra temporária: Se o bridge está online, nunca permitir PDF/Fallback.
    const isBridgeOnline = newPrinters.some(p => p.source === 'agent' || p.source === 'webusb');
    const hasFallback = newPrinters.some(p => p.source === 'fallback');

    if (isBridgeOnline && hasFallback) {
      console.warn("[PrinterSelector] DIAGNÓSTICO: Detectada mistura de Bridge + Fallback. Removendo fallbacks.");
      newPrinters = newPrinters.filter(p => p.source !== 'fallback');
    }

    console.groupEnd();
    setPrintersState(newPrinters);
  }, [printers]);

  const isBridgeOnline = React.useMemo(() => {
    const online = printers.some(p => p.source === 'agent' || p.source === 'webusb');
    console.log(`[PrinterSelector] [${new Date().toISOString()}] Calculando bridgeOnline:`, online);
    return online;
  }, [printers]);

  React.useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[PrinterSelector] [${timestamp}] useEffect executado (Montagem/Update)`);
    console.log("Dependências: value=", value, "isBridgeOnline=", isBridgeOnline);

    console.log(`[PrinterSelector] [${timestamp}] Iniciando busca de impressoras via printerService.listPrinters()`);
    
    setLoading(true);
    printerService.listPrinters().then(data => {
      const respTimestamp = new Date().toISOString();
      console.log(`[PrinterSelector] [${respTimestamp}] printerService.listPrinters() retornou ${data.length} impressoras`);
      
      setPrinters(data, "useEffect (printerService.listPrinters response)");
      setLoading(false);
      
      // Se não retornou nada, é porque o service detectou Bridge Offline e aplicou a regra de não fallback.
      if (data.length === 0) {
        setBridgeUnavailable(true);
      } else {
        setBridgeUnavailable(false);
      }

      if (!value && data.length > 0) {
        const physicalPrinters = data.filter(p => p.source !== 'fallback');
        if (physicalPrinters.length > 0) {
          const defaultPrinter = physicalPrinters.find(p => p.isDefault) || physicalPrinters[0];
          console.log(`[PrinterSelector] [${respTimestamp}] Seleção automática (Bridge):`, defaultPrinter.id);
          onValueChange(defaultPrinter.id);
        }
      }
    });
  }, [onValueChange, value, setPrinters, isBridgeOnline]);

  const groups = React.useMemo(() => {
    console.log(`[PrinterSelector] [${new Date().toISOString()}] [DEBUG 5] Agrupando por categoria...`);
    const grouped = printerService.groupByCategory(printers);
    Object.keys(grouped).forEach(cat => {
      console.log(`  Categoria ${cat}: ${grouped[cat as PrinterCategory]?.length} impressoras`);
    });
    return grouped;
  }, [printers]);

  console.log("=== ESTADO FINAL DO REACT ===");
  console.log("printers.length =", printers.length);
  console.table(printers);
  console.log("groups =", groups);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Impressora
      </label>
      
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <SelectValue placeholder="Selecione uma impressora" />
        </SelectTrigger>
        <SelectContent 
          className="z-[9999]" 
          position="popper" 
          sideOffset={5}
          avoidCollisions={true}
          collisionPadding={10}
        >
          {CATEGORY_ORDER.map(category => {
            const categoryPrinters = groups[category];
            if (!categoryPrinters || categoryPrinters.length === 0) return null;

            return (
              <SelectGroup key={category}>
                <SelectLabel className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                  {category}
                </SelectLabel>
                {categoryPrinters.map(printer => (
                  <SelectItem 
                    key={printer.id} 
                    value={printer.id}
                    className="py-2 focus:bg-blue-50 dark:focus:bg-blue-900/20"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs flex items-center gap-2">
                        {printer.source === 'agent' || printer.source === 'webusb' ? (
                          <PrinterIcon className="h-3 w-3 text-blue-500" />
                        ) : (
                          <Monitor className="h-3 w-3 text-slate-400" />
                        )}
                        {printer.name}
                      </span>
                      <span className="text-[9px] text-slate-500 font-medium">
                        {printer.driver} • {printer.port}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>

      {loading && (
        <div className="text-[10px] text-slate-400 animate-pulse flex items-center gap-1.5 mt-1">
          <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Buscando impressoras...
        </div>
      )}

      {bridgeUnavailable && !loading && printers.length === 0 && (
        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-md mt-2">
          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-tight">
            BRIDGE INDISPONÍVEL
          </p>
          <p className="text-[9px] text-amber-600 dark:text-amber-500 mt-0.5">
            Certifique-se que o NexOS Print Bridge está rodando na porta 48555.
          </p>
        </div>
      )}
    </div>
  );
};
