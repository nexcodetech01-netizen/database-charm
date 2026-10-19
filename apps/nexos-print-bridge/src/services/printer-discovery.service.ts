import { execFile, spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { logger } from '../config/logger';

export interface Printer {
  id: string;
  name: string;
  status: string;
  isDefault: boolean;
  port: string;
  driver: string;
}

/*
 * Descoberta de impressoras — à prova de Windows travado (19/10/2026).
 *
 * Antes: só PowerShell + Get-CimInstance (WMI). Quando o WMI do Windows
 * trava, o comando nunca responde, a lista volta vazia e o NexOS mostra
 * só "Microsoft Print to PDF".
 *
 * Agora:
 *   1. Lista principal pelo REGISTRO do Windows (reg.exe) — responde na
 *      hora, mesmo com o WMI travado. Traz nome, porta, driver e padrão.
 *   2. PowerShell/WMI roda em segundo plano só para completar o status
 *      (Pronta / Offline...). Se travar, não atrapalha.
 *   3. A última lista boa fica salva em disco: ao reiniciar o Bridge, as
 *      impressoras aparecem na hora, antes de qualquer consulta.
 */

const REG_TIMEOUT_MS = 5000;
const WMI_TIMEOUT_MS = 20000;
const CACHE_TTL_MS = 60_000;
const PRINTERS_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Print\\Printers';
const DEFAULT_KEY = 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Windows';
const CACHE_FILE = path.join(os.tmpdir(), 'nexos-print-bridge-printers.json');

const MOCK: Printer[] = [
  { id: 'mock-printer', name: 'Mock Printer', status: 'Idle', isDefault: true, port: 'LPT1', driver: 'Generic' },
];

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(String(stdout))),
    );
  });
}

/** Nomes das impressoras: subchaves diretas de ...\Print\Printers. */
export function parsePrinterKeys(output: string): string[] {
  const prefix = PRINTERS_KEY.replace('HKLM', 'HKEY_LOCAL_MACHINE').toLowerCase() + '\\';
  const names: string[] = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.toLowerCase().startsWith(prefix)) continue;
    const name = line.slice(prefix.length);
    if (name && !name.includes('\\')) names.push(name);
  }
  return names;
}

/** Valores "Nome    REG_SZ    valor" de um `reg query /v`. */
export function parseRegValue(output: string, valueName: string): string {
  const re = new RegExp(`^\\s*${valueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+REG_\\w+\\s+(.*)$`, 'im');
  return output.match(re)?.[1]?.trim() ?? '';
}

/** "LABEL TERMICA,winspool,Ne01:" → "LABEL TERMICA". */
export function parseDefaultDevice(output: string): string {
  const device = parseRegValue(output, 'Device');
  const idx = device.lastIndexOf(',winspool');
  return idx > 0 ? device.slice(0, idx) : device.split(',')[0] ?? '';
}

export class PrinterDiscoveryService {
  private cache: Printer[] | null = null;
  private lastDiscovery = 0;
  private inflight: Promise<Printer[]> | null = null;
  private wmiRunning = false;
  private loadedFromDisk = false;

  async discoverPrinters(): Promise<Printer[]> {
    if (process.platform !== 'win32') return MOCK;

    if (!this.loadedFromDisk) await this.loadDiskCache();

    const fresh = this.cache && Date.now() - this.lastDiscovery < CACHE_TTL_MS;
    if (fresh) return this.cache!;

    if (!this.inflight) {
      this.inflight = this.discoverFromRegistry()
        .then((printers) => {
          if (printers.length > 0) {
            this.setCache(printers);
            this.enrichWithWmiInBackground();
          }
          return printers;
        })
        .catch((error) => {
          logger.error('Registry discovery failed', error);
          this.enrichWithWmiInBackground();
          return [] as Printer[];
        })
        .finally(() => {
          this.inflight = null;
        });
    }

    const printers = await this.inflight;
    if (printers.length > 0) return this.cache ?? printers;
    // Registro falhou: devolve a última lista boa (memória ou disco).
    return this.cache ?? [];
  }

  private setCache(printers: Printer[]) {
    this.cache = printers;
    this.lastDiscovery = Date.now();
    fs.writeFile(CACHE_FILE, JSON.stringify(printers)).catch(() => {});
  }

  private async loadDiskCache() {
    this.loadedFromDisk = true;
    try {
      const saved = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'));
      if (Array.isArray(saved) && saved.length > 0) {
        this.cache = saved;
        this.lastDiscovery = 0; // usa já, mas atualiza na próxima consulta
        logger.info(`[Discovery] ${saved.length} impressora(s) carregadas do cache em disco`);
      }
    } catch {
      // sem cache salvo ainda
    }
  }

  private async discoverFromRegistry(): Promise<Printer[]> {
    const [keysOut, defaultOut] = await Promise.all([
      run('reg', ['query', PRINTERS_KEY], REG_TIMEOUT_MS),
      run('reg', ['query', DEFAULT_KEY, '/v', 'Device'], REG_TIMEOUT_MS).catch(() => ''),
    ]);
    const names = parsePrinterKeys(keysOut);
    const defaultName = parseDefaultDevice(defaultOut);

    const printers = await Promise.all(
      names.map(async (name) => {
        let port = '';
        let driver = '';
        try {
          const out = await run('reg', ['query', `${PRINTERS_KEY}\\${name}`], REG_TIMEOUT_MS);
          port = parseRegValue(out, 'Port');
          driver = parseRegValue(out, 'Printer Driver');
        } catch {
          // detalhes são opcionais
        }
        const previous = this.cache?.find((p) => p.name === name);
        return {
          id: name,
          name,
          status: previous?.status ?? 'Idle',
          isDefault: name === defaultName,
          port,
          driver,
        } satisfies Printer;
      }),
    );

    logger.info(`[Discovery] ${printers.length} impressora(s) pelo registro do Windows`);
    return printers;
  }

  /** Completa o status pelo WMI sem bloquear ninguém. */
  private enrichWithWmiInBackground() {
    if (this.wmiRunning) return;
    this.wmiRunning = true;
    this.discoverFromWmi()
      .then((wmi) => {
        if (wmi.length === 0) return;
        const base = this.cache && this.cache.length > 0 ? this.cache : wmi;
        const merged = base.map((p) => {
          const w = wmi.find((x) => x.name === p.name);
          return w ? { ...p, status: w.status, port: p.port || w.port, driver: p.driver || w.driver } : p;
        });
        this.setCache(merged);
      })
      .catch((err) => logger.warn(`[Discovery] WMI indisponível (lista do registro mantida): ${String(err?.message ?? err)}`))
      .finally(() => {
        this.wmiRunning = false;
      });
  }

  private discoverFromWmi(): Promise<Printer[]> {
    return new Promise((resolve, reject) => {
      const script =
        '@(Get-CimInstance Win32_Printer | Select-Object Name, PrinterStatus, Default, PortName, DriverName) | ConvertTo-Json';
      const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true,
      });
      const timer = setTimeout(() => {
        ps.kill();
        reject(new Error('Discovery timeout'));
      }, WMI_TIMEOUT_MS);

      let output = '';
      ps.stdout.on('data', (d) => (output += d.toString()));
      ps.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      ps.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`PowerShell exited with code ${code}`));
        try {
          if (!output.trim()) return resolve([]);
          const data = JSON.parse(output);
          const items = Array.isArray(data) ? data : [data];
          resolve(
            items.map((p: any) => ({
              id: p.Name,
              name: p.Name,
              status: this.mapStatus(p.PrinterStatus),
              isDefault: !!p.Default,
              port: p.PortName ?? '',
              driver: p.DriverName ?? '',
            })),
          );
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  private mapStatus(statusCode: number): string {
    const statusMap: Record<number, string> = {
      1: 'Other', 2: 'Unknown', 3: 'Idle', 4: 'Printing', 5: 'Warmup',
      6: 'Stopped printing', 7: 'Offline', 8: 'Paused', 9: 'Error', 10: 'Busy',
      11: 'Not Available', 12: 'Waiting', 13: 'Processing', 14: 'Initialization',
      15: 'Power Save', 16: 'Pending Deletion', 17: 'I/O Active', 18: 'Manual Feed',
    };
    return statusMap[statusCode] || 'Unknown';
  }
}
