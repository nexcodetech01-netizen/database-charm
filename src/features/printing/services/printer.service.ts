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
  `${PRINT_BRIDGE_URL}/printers`, // NexOS Print Bridge
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
  
  // A ID deve ser o nome se não houver ID única vinda do agente.
  // No Windows, o nome da impressora é o identificador único primário.
  const id = raw.id || name;

  return {
    id,
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
    const response = await fetch(url, { signal: controller.signal });
    
    if (!response.ok) {
      return [];
    }
    
    const json = await response.json();
    const list = Array.isArray(json) ? json : (json?.printers ?? []);
    
    return list.map((p: any) => ({
      ...p,
      source: p.source || 'agent'
    })) as RawPrinterInfo[];
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.warn(`[printer.service] Falha ao consultar agente em ${url}:`, err.message);
    }
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
    const url = `${PRINT_BRIDGE_URL}/health`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    
    try {
      const res = await fetch(url, { signal: controller.signal });
      return res.ok;
    } catch (err) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Lista TODAS as impressoras encontradas, sem qualquer filtro por tecnologia.
   */
  async listPrinters(): Promise<Printer[]> {
    const promises = AGENT_ENDPOINTS.map((url) => fetchFromAgent(url));
    promises.push(fetchFromWebUsb());

    const results = await Promise.all(promises);
    const allRaw = results.flat();
    
    if (allRaw.length === 0) {
      console.warn("[printer.service] Nenhuma impressora encontrada via agentes ou USB. Usando fallback.");
      return FALLBACK_PRINTERS.map((p, i) => toPrinter(p, i));
    }

    const normalized = allRaw.map((p, i) => toPrinter(p, i));

    // Deduplicação baseada em NOME + PORTO para evitar entradas duplicadas da mesma física
    const seen = new Set<string>();
    const deduped: Printer[] = [];

    for (const item of normalized) {
      // Normalizamos para evitar variações de case (ex: USB001 vs usb001)
      const key = `${(item.name ?? "").toLowerCase().trim()}|${(item.port ?? "").toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      } else {
        console.log(`[printer.service] Duplicata ignorada: ${item.name} em ${item.port}`);
      }
    }

    return deduped;
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
