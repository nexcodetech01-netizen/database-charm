export type PrintStrategy = 'PDF' | 'ZPL' | 'BROWSER' | 'RAW' | 'TSPL';

export interface LabelData {
  id: string;
  zpl?: string;
  content?: string; // Conteúdo genérico para outras linguagens (TSPL, etc)
  width?: number; // em polegadas
  height?: number; // em polegadas
  dpmm?: 8 | 12; // dots per mm
}

export type PrintJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface PrintJob {
  id: string;
  label: LabelData;
  options: PrintOptions;
  status: PrintJobStatus;
  printerId?: string;
  strategy: PrintStrategy;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  attempts: number;
  maxAttempts: number;
  error?: string;
  isRaw?: boolean;
  history: Array<{
    timestamp: Date;
    status: PrintJobStatus;
    message?: string;
    details?: any;
  }>;
}

export interface PrinterCapability {
  supportsZpl: boolean;
  supportsPdf: boolean;
  supportsRaw: boolean;
  supportsTspl: boolean;
  maxDpmm?: number;
  maxWidthInches?: number;
}

export interface PrinterProfile {
  id: string;
  name: string;
  type: 'USB' | 'NETWORK' | 'BLUETOOTH';
  address?: string; // IP ou porta
  capabilities: PrinterCapability;
  settings: Record<string, any>;
}

export interface PrintOptions {
  strategy: PrintStrategy;
  printerId?: string;
  copies?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface Printer extends PrinterProfile {
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  isDefault?: boolean;
}

export interface PrintResult {
  success: boolean;
  message?: string;
  jobId?: string;
  error?: Error;
}

export type PrintingEvent = 
  | { type: 'PRINT_STARTED'; jobId: string; timestamp: Date }
  | { type: 'PRINT_FINISHED'; jobId: string; timestamp: Date }
  | { type: 'PRINT_ERROR'; jobId: string; error: string; timestamp: Date }
  | { type: 'PRINT_CANCELLED'; jobId: string; timestamp: Date }
  | { type: 'PRINTER_STATUS_CHANGED'; printerId: string; status: Printer['status']; timestamp: Date };
