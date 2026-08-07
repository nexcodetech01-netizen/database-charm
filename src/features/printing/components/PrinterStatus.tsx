import React from 'react';
import { Printer } from '../types/printing.types';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface PrinterStatusProps {
  status: Printer['status'];
  showLabel?: boolean;
}

export const PrinterStatus: React.FC<PrinterStatusProps> = ({ status, showLabel = true }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'ONLINE':
        return {
          icon: <CheckCircle2 className="h-3 w-3" />,
          variant: 'default' as const,
          label: 'Online',
          className: 'bg-green-500 hover:bg-green-600'
        };
      case 'OFFLINE':
        return {
          icon: <XCircle className="h-3 w-3" />,
          variant: 'destructive' as const,
          label: 'Offline',
          className: ''
        };
      case 'BUSY':
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          variant: 'secondary' as const,
          label: 'Ocupada',
          className: 'bg-yellow-500 hover:bg-yellow-600 text-white'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge 
      variant={config.variant} 
      className={`flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${config.className}`}
    >
      {config.icon}
      {showLabel && config.label}
    </Badge>
  );
};
