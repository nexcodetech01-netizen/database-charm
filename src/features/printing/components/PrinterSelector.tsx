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
        Selecione a Impressora (MODO TESTE VISUAL)
      </label>
      
      <div style={{ border: '1px solid red', padding: 16, borderRadius: 8, background: '#fff' }}>
        <p style={{ fontWeight: 'bold', marginBottom: 8, color: 'red' }}>
          TESTE VISUAL: Sem componentes Radix/Select
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {printers.length === 0 && <p>Nenhuma impressora no estado.</p>}
          {printers.map(p => (
            <div
              key={p.id}
              style={{
                padding: 8,
                margin: 0,
                border: '1px solid #ccc',
                borderRadius: 4,
                fontSize: '13px',
                background: '#f9f9f9',
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span><strong>{p.name}</strong> | {p.category} | {p.port}</span>
              <span style={{ fontSize: '10px', color: '#666' }}>{p.source}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 p-2 bg-slate-100 rounded text-xs">
        <p><strong>Debug Info:</strong></p>
        <p>printers.length: {printers.length}</p>
        <p>loading: {String(loading)}</p>
        <p>bridgeUnavailable: {String(bridgeUnavailable)}</p>
      </div>
    </div>
  );
};
