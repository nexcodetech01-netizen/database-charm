import { Printer, PrinterCategory, RawPrinterInfo } from "../types/printing.types";
import { PRINT_BRIDGE_URL } from "@/config/print-bridge";

/**
 * Descoberta de impressoras — SEM FILTRO POR TECNOLOGIA.
 *
 * O navegador não enumera impressoras do Windows. A descoberta real depende de
 * um agente local (Print Bridge / QZ Tray) escutando em localhost. Este serviço
 * consulta todos os endpoints conhecidos, NÃO descarta nenhuma impressora
 * retornada pelo sistema e só depois classifica cada uma por finalidade.
 */

const AGENT_ENDPOINTS = [
  `${PRINT_BRIDGE_URL}/printers`, // NexOS Print Bridge (Porta principal configurada)
];

const AGENT_TIMEOUT_MS = 1500;

function classify(name: string, driver?: string): PrinterCategory {
  const haystack = `${name} ${driver ?? ""}`.toLowerCase();
  if (/pdf|xps|onenote|document writer/.test(haystack)) return "PDF";
  if (/zebra|zpl|elgin l42|argox|godex|tsc|datamax|intermec|dymo|brother ql|etiqueta|label/.test(haystack)) {
    return "Etiquetas";
  }
  if (/epson tm|bematech|daruma|xprinter|pos-?\d|elgin i9|elgin i7|termica|térmica|receipt|cupom|58mm|80mm/.test(haystack)) {
    return "Cupom";
  }
  return "Outras";
}

function inferType(port?: string, driver?: string): Printer["type"] {
  const p = `${port ?? ""} ${driver ?? ""}`.toLowerCase();
  if (/bth|bluetooth/.test(p)) return "BLUETOOTH";
  if (/ip_|tcp|wsd|net|\d+\.\d+\.\d+\.\d+/.test(p)) return "NETWORK";
  return "USB";
}

function toPrinter(raw: RawPrinterInfo, index: number): Printer {
  const name = raw.name ?? `Impressora ${index + 1}`;
  const category = classify(name, raw.driver);
  const type = raw.type ?? inferType(raw.port, raw.driver);
  return {
    id: raw.id ?? name,
    name,
    driver: raw.driver ?? "Desconhecido",
    port: raw.port ?? "Desconhecida",
    type,
    category,
    address: raw.port,
    status: raw.status ?? "ONLINE",
    isDefault: Boolean(raw.isDefault),
    source: raw.source ?? "agent",
    capabilities: {
      // Sem restrição: o agente envia bytes brutos para qualquer impressora.
      supportsPdf: true,
      supportsZpl: true,
      supportsRaw: true,
      supportsTspl: true,
    },
    settings: raw.settings ?? {},
  };
}

async function fetchFromAgent(url: string): Promise<RawPrinterInfo[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    const end = performance.now();
    console.log(`[printer.service] [DEBUG 1] Resposta bruta do GET ${url}: Status ${res.status}, Time: ${(end - start).toFixed(2)}ms`);
    
    if (!res.ok) {
      console.warn(`[printer.service] [DEBUG 1] GET ${url} falhou com status ${res.status}`);
      return [];
    }
    
    const body = await res.json();
    console.log(`[printer.service] [DEBUG 2] Resultado após parse do JSON de ${url}:`, JSON.stringify(body, null, 2));
    
    const list = Array.isArray(body) ? body : (body?.printers ?? []);
    console.log(`[printer.service] [DEBUG 2] Quantidade de impressoras identificadas no JSON: ${list.length}`);
    
    const result = Array.isArray(list) ? (list as RawPrinterInfo[]) : [];
    // Marcar a origem explicitamente se não vier do agente
    return result.map(p => ({ ...p, source: p.source || 'agent' }));
  } catch (err: any) {
    console.error(`[printer.service] [DEBUG 1] Erro no fetch de ${url}:`, err.message);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromWebUsb(): Promise<RawPrinterInfo[]> {
  const usb = typeof window !== 'undefined' ? (window.navigator as any)?.usb : null;
  if (!usb?.getDevices) return [];
  try {
    const devices = (await usb.getDevices()) as Array<{
      productName?: string;
      manufacturerName?: string;
      serialNumber?: string;
    }>;
    return devices.map((d, i) => ({
      id: d.serialNumber ?? `usb-${i}`,
      name: [d.manufacturerName, d.productName].filter(Boolean).join(" ") || `Dispositivo USB ${i + 1}`,
      driver: "WebUSB",
      port: "USB",
      type: "USB" as const,
      status: "ONLINE" as const,
      source: "webusb" as const,
    }));
  } catch {
    return [];
  }
}

/** Fallback quando nenhum agente local responde (ex.: preview/servidor). */
const FALLBACK_PRINTERS: RawPrinterInfo[] = [
  {
    id: "default-pdf",
    name: "Microsoft Print to PDF",
    driver: "Microsoft Print To PDF",
    port: "PORTPROMPT:",
    status: "ONLINE",
    isDefault: true,
    source: "fallback",
  },
];

export const printerService = {
  async checkHealth(): Promise<boolean> {
    const start = performance.now();
    const timestamp = new Date().toISOString();
    const url = `${PRINT_BRIDGE_URL}/health`;
    console.log(`[printer.service] [${timestamp}] GET /health iniciado. URL: ${url}`);
    
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    
    let result = false;
    try {
      const res = await fetch(url, { signal: controller.signal });
      const end = performance.now();
      
      const json = await res.json();
      
      console.log("Health URL:", url);
      console.log("HTTP:", res.status);
      console.log("JSON:", json);
      
      // Critério de aceite: status: "online" E 200 OK
      result = res.ok && json.status === "online";
      
      console.log("checkHealth retornou:", result);
      console.log(`[printer.service] [${new Date().toISOString()}] GET /health finalizado - Status: ${res.status} - Duração: ${(end - start).toFixed(2)}ms`);
      return result;
    } catch (err: any) {
      const end = performance.now();
      const reason = err.name === 'AbortError' ? 'Timeout' : err.message;
      console.error(`[printer.service] [${new Date().toISOString()}] GET /health falhou - Motivo: ${reason} - Duração: ${(end - start).toFixed(2)}ms`);
      result = false;
      console.log("checkHealth retornou:", result);
      return result;
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Lista TODAS as impressoras encontradas, sem qualquer filtro por tecnologia.
   */
  async listPrinters(): Promise<Printer[]> {
    const isBridgeHealthy = await this.checkHealth();
    
    const start = performance.now();
    const timestamp = new Date().toISOString();
    console.log(`[printer.service] [${timestamp}] listPrinters() iniciada. Bridge Healthy: ${isBridgeHealthy}`);

    const results = await Promise.all([
      ...AGENT_ENDPOINTS.map((url) => {
        console.log(`[printer.service] Fetching from endpoint: ${url}`);
        return fetchFromAgent(url);
      }),
      fetchFromWebUsb(),
    ]);

    const end = performance.now();
    const raw = results.flat();
    
    console.log(`[printer.service] [DEBUG 3] Resultado após normalização (Total Bruto): ${raw.length} impressoras`);
    raw.forEach((p, idx) => console.log(`  [${idx}] Nome: ${p.name}, Driver: ${p.driver}, Porta: ${p.port}, Origem: ${p.source}`));

    // Deduplica somente por identidade (nome + porta)
    const seen = new Set<string>();
    const unique: RawPrinterInfo[] = [];
    for (const item of raw) {
      const key = `${(item.name ?? "").toLowerCase()}|${(item.port ?? "").toLowerCase()}`;
      if (seen.has(key)) {
        console.log(`[printer.service] [DEBUG 4] Impressora descartada no dedupe (já vista): ${item.name} (${item.port})`);
        continue;
      }
      seen.add(key);
      unique.push(item);
    }

    console.log(`[printer.service] [DEBUG 4] Resultado após deduplicação: ${unique.length} impressoras`);
    unique.forEach((p, idx) => console.log(`  [${idx}] Nome: ${p.name}, Porta: ${p.port}, Origem: ${p.source}`));

    let source: RawPrinterInfo[];
    
    if (isBridgeHealthy) {
      // Se o bridge está saudável, usamos o que ele retornou + WebUSB.
      source = unique.filter(p => p.source === 'agent' || p.source === 'webusb');
      
      const discarded = unique.filter(p => p.source !== 'agent' && p.source !== 'webusb');
      if (discarded.length > 0) {
        console.log(`[printer.service] [DEBUG 5] Impressoras descartadas (não são Bridge/WebUSB): ${discarded.length}`);
        discarded.forEach(p => console.log(`  Descartada: ${p.name} (Origem: ${p.source})`));
      }
      
      console.log(`[printer.service] [DEBUG 5] Resultado final filtrado: ${source.length} impressoras (Windows/Agente: ${source.filter(p => p.source === 'agent').length})`);
    } else {
      console.warn(`[printer.service] [DEBUG 5] Bridge INDISPONÍVEL. Retornando vazio conforme regra de diagnóstico.`);
      source = [];
    }

    const printers = source.map((p, i) => toPrinter(p, i));
    
    console.log(`[printer.service] [DEBUG 6] Array final retornado ao PrinterSelector: ${printers.length} impressoras`);
    printers.forEach((p, idx) => {
      console.log(`  [${idx}] Nome: ${p.name}, Categoria: ${p.category}, Driver: ${p.driver}, Porta: ${p.port}, Origem: ${p.source}`);
    });

    if (typeof console !== "undefined") {
      console.groupCollapsed(
        `[printer.service] [${timestamp}] Descoberta Completa: ${raw.length} brutas -> ${printers.length} finais`
      );
      console.table(printers.map(p => ({ nome: p.name, categoria: p.category, origem: p.source, status: p.status })));
      console.groupEnd();
    }

    return printers;
  },

  /**
   * Agrupa (sem remover nenhuma) por finalidade.
   */
  groupByCategory(printers: Printer[]): Record<PrinterCategory, Printer[]> {
    const groups: Record<PrinterCategory, Printer[]> = {
      Etiquetas: [],
      Cupom: [],
      PDF: [],
      Outras: [],
    };
    for (const p of printers) groups[p.category ?? "Outras"].push(p);
    return groups;
  },

  classify,

  async getStatus(_printerId: string): Promise<Printer["status"]> {
    return "ONLINE";
  },
};
