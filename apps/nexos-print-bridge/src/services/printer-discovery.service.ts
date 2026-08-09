import { exec } from 'child_process';
import { promisify } from 'util';
import { PrinterInfo, PrinterType } from '../types/printer';
import { logger } from '../config/logger';

const execAsync = promisify(exec);

export class PrinterDiscoveryService {
  /**
   * Executa comandos PowerShell para obter informações reais do Windows Print Spooler.
   */
  async discoverPrinters(): Promise<PrinterInfo[]> {
    try {
      // Usamos PowerShell para obter dados estruturados em JSON
      // WMI/CIM Get-CimInstance Win32_Printer fornece detalhes como DriverName e PortName
      const command = `powershell -Command "Get-CimInstance Win32_Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Default, DeviceID | ConvertTo-Json"`;
      
      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        logger.error(`PowerShell Stderr: ${stderr}`);
      }

      if (!stdout || stdout.trim() === "") {
        return [];
      }

      let rawData = JSON.parse(stdout);
      
      // PowerShell retorna objeto único se houver apenas 1 impressora, ou array se houver várias
      const printersArray = Array.isArray(rawData) ? rawData : [rawData];

      const printers: PrinterInfo[] = printersArray.map((p: any) => {
        const name = p.Name || p.DeviceID;
        const type = this.classifyPrinter(name, p.DriverName);
        
        return {
          id: p.DeviceID || name,
          name: name,
          driver: p.DriverName || 'Unknown',
          port: p.PortName || 'Unknown',
          isDefault: !!p.Default,
          status: this.mapStatus(p.PrinterStatus),
          type: type
        };
      });

      // Log exigido no requisito 6
      this.logPrintersTable(printers);

      return printers;
    } catch (error) {
      logger.error('Erro na descoberta real de impressoras via PowerShell:', error);
      throw error;
    }
  }

  /**
   * Mapeia o código de status do Windows para string legível
   * Referência: https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-printer
   */
  private mapStatus(status: number): string {
    const statusMap: Record<number, string> = {
      1: 'Other',
      2: 'Unknown',
      3: 'Idle',
      4: 'Printing',
      5: 'Warmup',
      6: 'Stopped printing',
      7: 'Offline'
    };
    return statusMap[status] || 'Unknown';
  }

  /**
   * Classificação automática conforme requisito 4
   */
  private classifyPrinter(name: string, driver: string): PrinterType {
    const searchString = `${name} ${driver}`.toLowerCase();

    // Regras de heurística para classificação
    if (searchString.includes('zebra') || 
        searchString.includes('label') || 
        searchString.includes('argox') || 
        searchString.includes('zpl')) {
      return 'label';
    }

    if (searchString.includes('elgin') || 
        searchString.includes('bematech') || 
        searchString.includes('receipt') || 
        searchString.includes('pos-') || 
        searchString.includes('thermal') ||
        searchString.includes('esc/pos')) {
      return 'receipt';
    }

    if (searchString.includes('pdf') || 
        searchString.includes('hp ') || 
        searchString.includes('epson ') || 
        searchString.includes('canon') || 
        searchString.includes('brother') ||
        searchString.includes('document')) {
      return 'document';
    }

    return 'unknown';
  }

  /**
   * Exibe log formatado conforme requisito 6
   */
  private logPrintersTable(printers: PrinterInfo[]): void {
    const tableData = printers.map(p => ({
      'Nome': p.name,
      'Driver': p.driver,
      'Porta': p.port,
      'Status': p.status,
      'Padrão': p.isDefault ? 'Sim' : 'Não',
      'Tipo': p.type
    }));

    console.log('\n--- Auditoria de Impressoras Windows ---');
    console.table(tableData);
    logger.info(`Descoberta concluída: ${printers.length} impressoras encontradas.`);
  }
}
