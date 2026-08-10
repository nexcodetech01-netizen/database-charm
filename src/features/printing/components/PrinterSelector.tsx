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
        Selecione a Impressora
      </label>
      
      {bridgeUnavailable && printers.length === 0 ? (
        <div className="p-3 border border-destructive/50 bg-destructive/10 rounded-md text-destructive text-sm font-medium flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          Bridge indisponível
        </div>
      ) : (
        <Select value={value} onValueChange={onValueChange} disabled={loading}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione uma impressora'} />
          </SelectTrigger>
          <SelectContent>
            {/* O fallback Navegador (PDF) só aparece se bridgeOnline for falso E não estivermos em modo diagnóstico restrito */}
            {(!isBridgeOnline || value === 'browser') && !printers.some(p => p.source === 'agent') && (
              <SelectItem value="browser">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  <span>Navegador (PDF)</span>
                </div>
              </SelectItem>
            )}
            {CATEGORY_ORDER.filter(category => groups[category] && groups[category].length > 0).map(category => {
              console.log("Renderizando categoria:", category);
              console.table(groups[category]);
              
              return (
                <SelectGroup key={category}>
                  <SelectLabel>{category}</SelectLabel>
                  {groups[category].map(printer => (
                    <SelectItem key={printer.id} value={printer.id}>
                      <div className="flex items-center gap-2">
                        <PrinterIcon className="h-4 w-4" />
                        <span>{printer.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {printer.port} · {printer.type}
                          {printer.isDefault ? ' · padrão' : ''}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>
      )}
      
      {!loading && !bridgeUnavailable && (
        <p className="text-xs text-muted-foreground italic">
          {printers.length} impressora(s) física(s) detectada(s) via Bridge {isBridgeOnline ? '(Online)' : '(Offline)'}.
        </p>
      )}
    </div>
  );
};
