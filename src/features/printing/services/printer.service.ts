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
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const body = await res.json();
    const list = Array.isArray(body) ? body : (body?.printers ?? []);
    return Array.isArray(list) ? (list as RawPrinterInfo[]) : [];
  } catch {
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
    console.log(`[printer.service] [${timestamp}] GET /printers iniciada`);
    console.trace("[printer.service] Stack trace da chamada listPrinters");

    const results = await Promise.all([
      ...AGENT_ENDPOINTS.map((url) => fetchFromAgent(url)),
      fetchFromWebUsb(),
    ]);

    const end = performance.now();
    console.log(`[printer.service] [${new Date().toISOString()}] GET /printers finalizada - Duração: ${(end - start).toFixed(2)}ms`);

    const raw = results.flat();
    console.log(`[printer.service] [${timestamp}] Impressoras brutas recebidas:`, raw);

    // Deduplica somente por identidade (nome + porta) — nunca por tecnologia.
    const seen = new Set<string>();
    const unique: RawPrinterInfo[] = [];
    for (const item of raw) {
      const key = `${(item.name ?? "").toLowerCase()}|${(item.port ?? "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }

    console.log(`[printer.service] [${timestamp}] Impressoras após deduplicação:`, unique);

    let source: RawPrinterInfo[];
    
    // Regras temporárias de diagnóstico:
    if (isBridgeHealthy) {
      console.log(`[printer.service] [${timestamp}] Bridge saudável (200 OK). FORÇANDO EXCLUSIVIDADE do Bridge. Removendo qualquer fallback.`);
      // Se o bridge está saudável, usamos apenas o que ele retornou + WebUSB, removendo explicitamente qualquer fallback.
      source = unique.filter(p => p.source !== 'fallback');
    } else {
      console.warn(`[printer.service] [${timestamp}] Bridge INDISPONÍVEL. Retornando lista vazia para evitar substituição silenciosa.`);
      // Se falhou o health check, não retornamos fallbacks (PDF). Retornamos vazio para que o UI trate.
      source = [];
    }

    const printers = source.map((p, i) => toPrinter(p, i));

    console.log(`[printer.service] [${timestamp}] listPrinters retornando final:`, printers);

    if (typeof console !== "undefined") {
      console.groupCollapsed(
        `[printer.service] [${timestamp}] Sumário Diagnóstico: ${raw.length} brutas · ${printers.length} finais (Healthy: ${isBridgeHealthy})`,
      );
      console.table(
        printers.map((p) => ({
          nome: p.name,
          driver: p.driver,
          porta: p.port,
          status: p.status,
          padrão: p.isDefault ? "Sim" : "Não",
          tipo: p.type,
          classificação: p.category,
          origem: p.source,
        })),
      );
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
