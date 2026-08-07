import React from 'react';
import { Printer } from '../types/printing.types';
import { printerService } from '../services/printer.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Printer as PrinterIcon } from 'lucide-react';

interface PrinterSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
}

export const PrinterSelector: React.FC<PrinterSelectorProps> = ({ value, onValueChange }) => {
  const [printers, setPrinters] = React.useState<Printer[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    printerService.listPrinters().then(data => {
      setPrinters(data);
      setLoading(false);
      if (!value && data.length > 0) {
        const defaultPrinter = data.find(p => p.isDefault) || data[0];
        onValueChange(defaultPrinter.id);
      }
    });
  }, [onValueChange, value]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Selecione a Impressora
      </label>
      <Select value={value} onValueChange={onValueChange} disabled={loading}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? "Carregando..." : "Selecione uma impressora"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="browser">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              <span>Navegador (PDF)</span>
            </div>
          </SelectItem>
          {printers.map(printer => (
            <SelectItem key={printer.id} value={printer.id}>
              <div className="flex items-center gap-2">
                <PrinterIcon className="h-4 w-4" />
                <span>{printer.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
