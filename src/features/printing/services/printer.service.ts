import { Printer } from "../types/printing.types";

/**
 * Serviço para gestão de impressoras
 */
export const printerService = {
  /**
   * Lista impressoras disponíveis
   */
  async listPrinters(): Promise<Printer[]> {
    return [
      {
        id: 'default-pdf',
        name: 'Microsoft Print to PDF',
        type: 'USB',
        status: 'ONLINE',
        isDefault: true,
        capabilities: {
          supportsPdf: true,
          supportsZpl: false,
          supportsRaw: false,
          supportsTspl: false
        },
        settings: {}
      },
      {
        id: 'zebra-label-1',
        name: 'Zebra GK420t (ZPL)',
        type: 'USB',
        status: 'ONLINE',
        capabilities: {
          supportsPdf: false,
          supportsZpl: true,
          supportsRaw: true,
          supportsTspl: false,
          maxWidthInches: 4
        },
        settings: {
          darkness: 15,
          speed: 4
        }
      }
    ];
  },

  /**
   * Verifica o status de uma impressora específica
   */
  async getStatus(printerId: string): Promise<Printer['status']> {
    return 'ONLINE';
  }
};
