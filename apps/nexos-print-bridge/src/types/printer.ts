export type PrinterType = 'label' | 'receipt' | 'document' | 'unknown';

export interface PrinterInfo {
  id: string;
  name: string;
  driver: string;
  port: string;
  isDefault: boolean;
  status: string;
  type: PrinterType;
}
