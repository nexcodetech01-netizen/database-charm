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

  // Instrumentação do estado printers
  const setPrinters = React.useCallback((newPrinters: Printer[], origem: string) => {
    const timestamp = new Date().toISOString();
    console.group(`[PrinterSelector] [${timestamp}] setPrinters chamado`);
    console.log(`Origem: ${origem}`);
    console.log("Estado anterior printers:", printers);
    console.log("Novos printers a definir:", newPrinters);
    console.trace("Stack trace da chamada setPrinters");
    
    // Critério: O estado printers nunca pode ser sobrescrito pelo fallback quando bridgeOnline === true
    const isBridgeOnline = newPrinters.some(p => p.source === 'agent' || p.source === 'webusb');
    const wasBridgeOnline = printers.some(p => p.source === 'agent' || p.source === 'webusb');

    if (wasBridgeOnline && !isBridgeOnline && newPrinters.every(p => p.source === 'fallback')) {
      console.error("BLOQUEIO: Tentativa de sobrescrever impressoras do Bridge com fallback!");
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
    printerService.listPrinters().then(data => {
      const respTimestamp = new Date().toISOString();
      console.log(`[PrinterSelector] [${respTimestamp}] printerService.listPrinters() retornou dados`);
      setPrinters(data, "useEffect (printerService.listPrinters response)");
      setLoading(false);

      if (!value && data.length > 0) {
        // Se o bridge estiver online, priorizamos impressoras físicas sobre o navegador
        if (isBridgeOnline) {
          const physicalPrinters = data.filter(p => p.source !== 'fallback');
          const defaultPrinter = physicalPrinters.find(p => p.isDefault) || physicalPrinters[0];
          if (defaultPrinter) {
            console.log(`[PrinterSelector] [${respTimestamp}] Seleção automática (Bridge):`, defaultPrinter.id);
            onValueChange(defaultPrinter.id);
          }
        } else {
          console.log(`[PrinterSelector] [${respTimestamp}] Fallback executado: Navegador (PDF)`);
          onValueChange('browser');
        }
      }
    });
  }, [onValueChange, value, setPrinters, isBridgeOnline]);

  const groups = React.useMemo(() => {
    console.log(`[PrinterSelector] [${new Date().toISOString()}] Rendered printers (agrupando):`, printers);
    return printerService.groupByCategory(printers);
  }, [printers]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Selecione a Impressora
      </label>
      <Select value={value} onValueChange={onValueChange} disabled={loading}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? 'Carregando...' : 'Selecione uma impressora'} />
        </SelectTrigger>
        <SelectContent>
          {(!isBridgeOnline || value === 'browser') && (
            <SelectItem value="browser">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                <span>Navegador (PDF)</span>
              </div>
            </SelectItem>
          )}
          {CATEGORY_ORDER.filter(category => groups[category] && groups[category].length > 0).map(category => (
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
          ))}
        </SelectContent>
      </Select>
      {!loading && (
        <p className="text-xs text-muted-foreground italic">
          {printers.length} impressora(s) física(s) detectada(s) via Bridge {isBridgeOnline ? '(Online)' : '(Offline)'}.
        </p>
      )}
    </div>
  );
};
