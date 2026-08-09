import { PrinterInfo } from '../types/printer';

export class PrinterDiscoveryService {
  async discoverPrinters(): Promise<PrinterInfo[]> {
    // Implementação mockada inicial
    return [
      {
        id: 'zebra-lp2844',
        name: 'Zebra LP2844',
        driver: 'ZDesigner LP 2844',
        port: 'USB001',
        isDefault: true,
        status: 'online',
        type: 'label'
      },
      {
        id: 'elgin-i9',
        name: 'Elgin i9',
        driver: 'Elgin i9 Printer',
        port: 'USB002',
        isDefault: false,
        status: 'online',
        type: 'receipt'
      },
      {
        id: 'microsoft-pdf',
        name: 'Microsoft Print to PDF',
        driver: 'Microsoft Print To PDF',
        port: 'PORTPROMPT:',
        isDefault: false,
        status: 'online',
        type: 'pdf'
      }
    ];
  }
}
