import React, { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface Printer {
  id: string;
  name: string;
  type: 'ZPL' | 'PDF';
  isDefault?: boolean;
}

interface PrinterSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
}

export function PrinterSelector({ value, onValueChange }: PrinterSelectorProps) {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPrinters() {
      try {
        // Fallback printers
        const list: Printer[] = [
          { id: 'pdf-browser', name: 'PDF (Navegador)', type: 'PDF', isDefault: true }
        ];

        // Tenta buscar do Bridge se disponível (Porta 48555 conforme SPRINT 1.2)
        try {
          const response = await fetch('http://localhost:48555/printers', { signal: AbortSignal.timeout(1000) });
          if (response.ok) {
            const bridgePrinters = await response.json();
            if (Array.isArray(bridgePrinters)) {
              list.push(...bridgePrinters.map((p: any) => ({
                id: p.name,
                name: p.name,
                type: 'ZPL' as const
              })));
            }
          }
        } catch (e) {
          console.log("Bridge offline ou inacessível");
        }

        setPrinters(list);
      } finally {
        setLoading(false);
      }
    }
    loadPrinters();
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="" disabled>Selecione uma impressora</option>
      {printers.map((printer) => (
        <option key={printer.id} value={printer.id}>
          {printer.name} ({printer.type})
        </option>
      ))}
    </select>
  );
}
