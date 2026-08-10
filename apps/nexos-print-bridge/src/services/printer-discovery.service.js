import { spawn } from 'child_process';
import { logger } from '../config/logger';
export class PrinterDiscoveryService {
    cache = null;
    lastDiscovery = 0;
    CACHE_TTL = 300000; // 5 minutos
    async discoverPrinters() {
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
        }
        catch (error) {
            logger.error('Discovery failed, using cache if available', error);
            return this.cache || [];
        }
    }
    async discoverFromOS() {
        return new Promise((resolve, reject) => {
            // Comando PowerShell para listar impressoras (Requirement 2: Discovery)
            const script = `Get-CimInstance Win32_Printer | Select-Object Name, PrinterStatus, Default, PortName, DriverName | ConvertTo-Json`;
            const ps = spawn('powershell.exe', ['-Command', script]);
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
                    const data = JSON.parse(output);
                    const printers = (Array.isArray(data) ? data : [data]).map((p) => ({
                        id: p.Name,
                        name: p.Name,
                        status: this.mapStatus(p.PrinterStatus),
                        isDefault: !!p.Default,
                        port: p.PortName,
                        driver: p.DriverName
                    }));
                    resolve(printers);
                }
                catch (e) {
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
    mapStatus(statusCode) {
        const statusMap = {
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
