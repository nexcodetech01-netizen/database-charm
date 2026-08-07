import { Printer } from "../types/printing.types";

/**
 * Serviço para gestão de impressoras
 * Nesta Sprint 1 apenas define a estrutura para futura detecção automática.
 */
export const printerService = {
  /**
   * Lista impressoras disponíveis (Mock para Sprint 1)
   */
  async listPrinters(): Promise<Printer[]> {
    return [
      {
        id: 'default-pdf',
        name: 'Microsoft Print to PDF',
        type: 'USB',
        status: 'ONLINE',
        isDefault: true
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
