import React from 'react';
import { usePrinters } from '../services/printer.service';

interface PrinterSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function PrinterSelector({ value, onValueChange }: PrinterSelectorProps) {
  const { printers, loading } = usePrinters();

  if (loading) {
    return <div className="h-10 w-full animate-pulse rounded-md bg-muted" />;
  }

  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
      >
        <option value="" disabled>Selecione uma impressora</option>
        {printers.map((printer) => (
          <option key={printer.id} value={printer.id}>
            {printer.name} {printer.isDefault ? '(Padrão)' : ''}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}
