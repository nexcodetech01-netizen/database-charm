import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, Wifi, Bluetooth, Usb, Settings2 } from "lucide-react";
import { Printer as PrinterType } from "../../types/printing.types";
import { Button } from "@/components/ui/button";

interface PrinterCardProps {
  printer: PrinterType;
  onSelect?: (printer: PrinterType) => void;
  onSettings?: (printer: PrinterType) => void;
}

export function PrinterCard({ printer, onSelect, onSettings }: PrinterCardProps) {
  const getIcon = () => {
    switch (printer.type) {
      case 'NETWORK': return <Wifi className="h-4 w-4" />;
      case 'BLUETOOTH': return <Bluetooth className="h-4 w-4" />;
      case 'USB': return <Usb className="h-4 w-4" />;
      default: return <Printer className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (printer.status) {
      case 'ONLINE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'BUSY': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'OFFLINE': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-500';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => onSelect?.(printer)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {getIcon()}
          </div>
          <div>
            <CardTitle className="text-sm font-bold">{printer.name}</CardTitle>
            <CardDescription className="text-xs">{printer.type} Printer</CardDescription>
          </div>
        </div>
        <Badge variant="outline" className={getStatusColor()}>
          {printer.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1 mt-2">
          {printer.capabilities.supportsZpl && <Badge variant="secondary" className="text-[10px] py-0">ZPL</Badge>}
          {printer.capabilities.supportsPdf && <Badge variant="secondary" className="text-[10px] py-0">PDF</Badge>}
          {printer.capabilities.supportsTspl && <Badge variant="secondary" className="text-[10px] py-0">TSPL</Badge>}
        </div>
        <div className="flex justify-end mt-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onSettings?.(printer);
            }}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
