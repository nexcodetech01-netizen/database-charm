import { spawn } from 'child_process';
import { logger } from '../config/logger';

export interface Printer {
  id: string;
  name: string;
  status: string;
  isDefault: boolean;
  port: string;
  driver: string;
}

export class PrinterDiscoveryService {
  private cache: Printer[] | null = null;
  private lastDiscovery: number = 0;
  private readonly CACHE_TTL = 300000; // 5 minutos

  async discoverPrinters(): Promise<Printer[]> {
    const now = Date.now();
    
    // Se o Windows demorar, usamos o cache (Requirement 4)
    if (this.cache && (now - this.lastDiscovery < this.CACHE_TTL)) {
      // Atualiza em background
      this.discoverFromOS().then(printers => {
        this.cache = printers;
        this.lastDiscovery = Date.now();
      }).catch(err => logger.error('Background discovery failed', err));
      
      return this.cache;
    }

    try {
      const printers = await this.discoverFromOS();
      this.cache = printers;
      this.lastDiscovery = now;
      return printers;
    } catch (error) {
      logger.error('Discovery failed, using cache if available', error);
      return this.cache || [];
    }
  }

  private async discoverFromOS(): Promise<Printer[]> {
    return new Promise((resolve, reject) => {
      // Comando PowerShell para listar impressoras (Requirement 2: Discovery)
      // Usamos @() para garantir que o resultado seja sempre um array, mesmo com 1 item
      const script = `@(Get-CimInstance Win32_Printer | Select-Object Name, PrinterStatus, Default, PortName, DriverName) | ConvertTo-Json`;
      
      const ps = spawn('powershell.exe', ['-Command', script]);
      
      ps.on('error', (err) => {
        // Fallback imediato se o comando falhar (ex: não estamos no Windows)
        if (process.platform !== 'win32') {
           resolve([{ id: 'mock-printer', name: 'Mock Printer', status: 'Idle', isDefault: true, port: 'LPT1', driver: 'Generic' }]);
        } else {
           reject(err);
        }
      });
      
      let output = '';
      ps.stdout.on('data', (data) => {
        output += data.toString();
      });

      ps.on('close', (code) => {
        if (code !== 0) {
          // Fallback para ambientes não-Windows (desenvolvimento)
          if (process.platform !== 'win32') {
             resolve([{ id: 'mock-printer', name: 'Mock Printer', status: 'Idle', isDefault: true, port: 'LPT1', driver: 'Generic' }]);
             return;
          }
          reject(new Error(`PowerShell exited with code ${code}`));
          return;
        }

        try {
          if (!output.trim()) {
            resolve([]);
            return;
          }
          
          // Auditoria solicitada: Log do resultado bruto antes de qualquer processamento
          logger.info(`[Discovery] PowerShell RAW Output: ${output.substring(0, 500)}${output.length > 500 ? '...' : ''}`);
          
          const data = JSON.parse(output);
          
          // O script PowerShell com @(...) | ConvertTo-Json DEVE retornar um array.
          // Mas mantemos a proteção Array.isArray por segurança.
          const rawItems = Array.isArray(data) ? data : [data];
          
          const printers = rawItems.map((p: any) => ({
            id: p.Name,
            name: p.Name,
            status: this.mapStatus(p.PrinterStatus),
            isDefault: !!p.Default,
            port: p.PortName,
            driver: p.DriverName
          }));
          
          logger.info(`[Discovery] Mapped ${printers.length} printers from OS`);
          resolve(printers);
        } catch (e) {
          logger.error('JSON Parse error on PowerShell output', e);
          reject(e);
        }
      });
      
      // Timeout para o comando shell
      setTimeout(() => {
        ps.kill();
        reject(new Error('Discovery timeout'));
      }, 5000);
    });
  }

  private mapStatus(statusCode: number): string {
    const statusMap: Record<number, string> = {
      1: 'Other',
      2: 'Unknown',
      3: 'Idle',
      4: 'Printing',
      5: 'Warmup',
      6: 'Stopped printing',
      7: 'Offline',
      8: 'Paused',
      9: 'Error',
      10: 'Busy',
      11: 'Not Available',
      12: 'Waiting',
      13: 'Processing',
      14: 'Initialization',
      15: 'Power Save',
      16: 'Pending Deletion',
      17: 'I/O Active',
      18: 'Manual Feed'
    };
    return statusMap[statusCode] || 'Unknown';
  }
}
