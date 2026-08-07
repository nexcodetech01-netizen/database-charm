export type PrintStrategy = 'PDF' | 'ZPL' | 'BROWSER' | 'RAW';

export interface LabelData {
  id: string;
  zpl: string;
  width?: number; // em polegadas
  height?: number; // em polegadas
  dpmm?: 8 | 12; // dots per mm
}

export interface PrintOptions {
  strategy: PrintStrategy;
  printerId?: string;
  copies?: number;
}

export interface Printer {
  id: string;
  name: string;
  type: 'USB' | 'NETWORK' | 'BLUETOOTH';
  status: 'ONLINE' | 'OFFLINE' | 'BUSY';
  isDefault?: boolean;
}

export interface PrintResult {
  success: boolean;
  message?: string;
  error?: Error;
}
