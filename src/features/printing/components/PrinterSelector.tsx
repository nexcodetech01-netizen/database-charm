import React from 'react';
import { Printer } from '../types/printing.types';
import { printerService } from '../services/printer.service';
import { Monitor, Printer as PrinterIcon } from 'lucide-react';

interface PrinterSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
}



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


  console.log("=== ESTADO FINAL DO REACT ===");
  console.log("printers.length =", printers.length);
  console.table(printers);
  

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Impressora
      </label>
      
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100 cursor-pointer"
      >
        <option value="" disabled>Selecione uma impressora</option>
        {printers.map(printer => (
          <option key={printer.id} value={printer.id}>
            {printer.name} ({printer.category} - {printer.port})
          </option>
        ))}
      </select>

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
