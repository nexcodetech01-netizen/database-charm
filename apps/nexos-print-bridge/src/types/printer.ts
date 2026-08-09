export interface PrinterInfo {
  id: string;
  name: string;
  driver: string;
  port: string;
  isDefault: boolean;
  status: string;
  type: 'label' | 'receipt' | 'pdf' | 'other';
}
