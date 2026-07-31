/**
 * Code 128 (subsets B e C) — gerador puro, sem dependências.
 *
 * Usado apenas para RENDERIZAÇÃO de etiquetas. Nenhuma regra de negócio,
 * nenhum acesso a banco. Totalmente testável.
 */

/** Padrões oficiais do Code 128 (índices 0..105 + STOP em 106). */
const PATTERNS = [
  "11011001100", "11001101100", "11001100110", "10010011000", "10010001100",
  "10001001100", "10011001000", "10011000100", "10001100100", "11001001000",
  "11001000100", "11000100100", "10110011100", "10011011100", "10011001110",
  "10111001100", "10011101100", "10011100110", "11001110010", "11001011100",
  "11001001110", "11011100100", "11001110100", "11101101110", "11101001100",
  "11100101100", "11100100110", "11101100100", "11100110100", "11100110010",
  "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
  "10001000110", "10110001000", "10001101000", "10001100010", "11010001000",
  "11000101000", "11000100010", "10110111000", "10110001110", "10001101110",
  "10111011000", "10111000110", "10001110110", "11101110110", "11010001110",
  "11000101110", "11011101000", "11011100010", "11011101110", "11101011000",
  "11101000110", "11100010110", "11101101000", "11101100010", "11100011010",
  "11101111010", "11001000010", "11110001010", "10100110000", "10100001100",
  "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
  "10110000100", "10011010000", "10011000010", "10000110100", "10000110010",
  "11000010010", "11001010000", "11110111010", "11000010100", "10001111010",
  "10100111100", "10010111100", "10010011110", "10111100100", "10011110100",
  "10011110010", "11110100100", "11110010100", "11110010010", "11011011110",
  "11011110110", "11110110110", "10101111000", "10100011110", "10001011110",
  "10111101000", "10111100010", "11110101000", "11110100010", "10111011110",
  "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
  "11010011100", "1100011101011",
];

const START_B = 104;
const START_C = 105;
const STOP = 106;

export type Code128Subset = "B" | "C";

/** Escolhe o subset: C para dígitos em quantidade par, B caso contrário. */
export function pickCode128Subset(value: string): Code128Subset {
  return /^\d+$/.test(value) && value.length % 2 === 0 ? "C" : "B";
}

/** Sanitiza o valor mantendo apenas caracteres imprimíveis ASCII (32..126). */
export function sanitizeCode128(value: string): string {
  return Array.from(value ?? "")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code >= 32 && code <= 126;
    })
    .join("");
}

/** Converte o valor em códigos Code 128 (sem start/checksum/stop). */
function toCodes(value: string, subset: Code128Subset): number[] {
  if (subset === "C") {
    const codes: number[] = [];
    for (let i = 0; i < value.length; i += 2) {
      codes.push(Number(value.slice(i, i + 2)));
    }
    return codes;
  }
  return Array.from(value).map((c) => c.charCodeAt(0) - 32);
}

export interface Code128Encoding {
  subset: Code128Subset;
  /** Sequência de módulos "0"/"1" (1 = barra). */
  modules: string;
  checksum: number;
}

/** Codifica um valor em Code 128. Lança se o valor ficar vazio. */
export function encodeCode128(rawValue: string): Code128Encoding {
  const value = sanitizeCode128(rawValue);
  if (!value) throw new Error("Valor inválido para código de barras.");

  const subset = pickCode128Subset(value);
  const start = subset === "C" ? START_C : START_B;
  const codes = toCodes(value, subset);

  let sum = start;
  codes.forEach((code, index) => {
    sum += code * (index + 1);
  });
  const checksum = sum % 103;

  const modules = [start, ...codes, checksum, STOP]
    .map((code) => PATTERNS[code])
    .join("");

  return { subset, modules, checksum };
}

export interface BarcodeSvgOptions {
  /** Largura do módulo em px (default 2). */
  moduleWidth?: number;
  /** Altura das barras em px (default 48). */
  height?: number;
  /** Exibe o valor legível abaixo das barras. */
  displayValue?: boolean;
}

/**
 * Gera um SVG (string) do código de barras. Escala via `width: 100%` para
 * caber na etiqueta, preservando o aspect ratio pelo viewBox.
 */
export function renderCode128Svg(
  rawValue: string,
  options: BarcodeSvgOptions = {},
): string {
  const { moduleWidth = 2, height = 48, displayValue = true } = options;
  const value = sanitizeCode128(rawValue);
  const { modules } = encodeCode128(value);

  const textHeight = displayValue ? 14 : 0;
  const width = modules.length * moduleWidth;
  const totalHeight = height + textHeight;

  const rects: string[] = [];
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === "1") {
      let run = 1;
      while (modules[i + run] === "1") run += 1;
      rects.push(
        `<rect x="${i * moduleWidth}" y="0" width="${run * moduleWidth}" height="${height}" fill="#000"/>`,
      );
      i += run;
    } else {
      i += 1;
    }
  }

  const label = displayValue
    ? `<text x="${width / 2}" y="${height + 12}" text-anchor="middle" font-family="monospace" font-size="12" fill="#000">${escapeXml(value)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">${rects.join("")}${label}</svg>`;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
