/**
 * Importação CSV de produtos (Sprint 002).
 *
 * Parser puro (sem I/O). Preparado para extensões futuras (Excel/XML)
 * expondo o mesmo shape `ParsedProductRow`. Toda linha é validada com
 * Zod estrita — nada é enviado ao banco a partir daqui: o consumidor
 * chama `ProductService.create` linha a linha, respeitando RLS/RBAC.
 */
import { z } from "zod";

export const ParsedProductRowSchema = z
  .object({
    name: z.string().trim().min(1, "Nome obrigatório").max(200),
    price: z.number().nonnegative(),
    cost: z.number().nonnegative().optional(),
    sku: z.string().trim().max(64).optional(),
    unit: z.string().trim().max(8).optional(),
    barcode: z.string().trim().max(64).optional(),
    minStock: z.number().nonnegative().optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();

export type ParsedProductRow = z.infer<typeof ParsedProductRowSchema>;

export interface CsvIssue {
  line: number;
  message: string;
}

export interface CsvParseResult {
  rows: ParsedProductRow[];
  issues: CsvIssue[];
}

// Colunas aceitas (case-insensitive, pt/en). Extensível.
const COLUMN_ALIAS: Record<string, keyof ParsedProductRow> = {
  name: "name",
  nome: "name",
  produto: "name",
  price: "price",
  preco: "price",
  "preço": "price",
  cost: "cost",
  custo: "cost",
  sku: "sku",
  codigo: "sku",
  "código": "sku",
  unit: "unit",
  unidade: "unit",
  barcode: "barcode",
  ean: "barcode",
  "codigo de barras": "barcode",
  minstock: "minStock",
  "estoque minimo": "minStock",
  "estoque mínimo": "minStock",
  description: "description",
  descricao: "description",
  "descrição": "description",
};

function normHeader(h: string): keyof ParsedProductRow | null {
  const key = h.trim().toLowerCase().replace(/^"|"$/g, "");
  return COLUMN_ALIAS[key] ?? null;
}

function parseNumber(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const cleaned = t.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!cleaned || !/\d/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** Split RFC-4180-lite (aspas duplas, sem escape multiline). */
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

export interface ParseOptions {
  /** Limite defensivo contra DoS. Default 5000 linhas. */
  maxRows?: number;
  /** Delimitador (auto-detect entre ';' e ','). */
  delimiter?: "," | ";";
}

/**
 * Parseia texto CSV em linhas validadas.
 * Nenhum IO. Nenhum acesso ao banco. Nunca joga erro — devolve `issues`.
 */
export function parseProductsCsv(input: string, opts: ParseOptions = {}): CsvParseResult {
  const maxRows = Math.min(20000, Math.max(1, opts.maxRows ?? 5000));
  const text = input.replace(/^\uFEFF/, "");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l)
    .filter((l, idx) => idx === 0 || l.trim().length > 0);

  const issues: CsvIssue[] = [];
  if (lines.length === 0) return { rows: [], issues: [{ line: 0, message: "CSV vazio." }] };

  const delimiter =
    opts.delimiter ?? ((lines[0].split(";").length > lines[0].split(",").length) ? ";" : ",");

  const rawHeaders = splitCsvLine(lines[0], delimiter);
  const headers = rawHeaders.map(normHeader);
  if (!headers.includes("name") || !headers.includes("price")) {
    return {
      rows: [],
      issues: [
        {
          line: 1,
          message: "CSV precisa conter ao menos as colunas 'name' e 'price'.",
        },
      ],
    };
  }

  const rows: ParsedProductRow[] = [];
  for (let i = 1; i < lines.length && rows.length < maxRows; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    const record: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const raw = (cols[c] ?? "").trim();
      if (raw === "") continue;
      if (key === "price" || key === "cost" || key === "minStock") {
        const n = parseNumber(raw);
        if (n !== undefined) record[key] = n;
      } else {
        record[key] = raw;
      }
    }
    const parsed = ParsedProductRowSchema.safeParse(record);
    if (parsed.success) rows.push(parsed.data);
    else {
      issues.push({
        line: i + 1,
        message: parsed.error.issues.map((x) => `${x.path.join(".") || "row"}: ${x.message}`).join(" · "),
      });
    }
  }

  if (rows.length + issues.length === 0) {
    issues.push({ line: 1, message: "Nenhuma linha válida encontrada." });
  }

  return { rows, issues };
}
