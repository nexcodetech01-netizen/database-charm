/**
 * Utilitários de apresentação do XML da NF-e.
 *
 * IMPORTANTE: nada aqui altera o conteúdo armazenado. O XML original
 * permanece intacto no storage — a formatação é apenas para exibição.
 */

import { normalizeAccessKey } from "./access-key";

export type XmlNaming = {
  number?: number | string | null;
  series?: number | string | null;
  accessKey?: string | null;
};

function pad(value: number | string, size: number): string {
  return String(value).padStart(size, "0");
}

/** Nome amigável do arquivo: NFe-000002-Serie-001.xml (fallback pela chave). */
export function buildXmlFileName(doc: XmlNaming): string {
  if (doc.number != null && doc.number !== "") {
    const num = pad(doc.number, 6);
    const serie = pad(doc.series ?? 1, 3);
    return `NFe-${num}-Serie-${serie}.xml`;
  }
  const key = normalizeAccessKey(doc.accessKey);
  if (key) return `NFe-${key}.xml`;
  return "NFe.xml";
}

/** Nome amigável do PDF da DANFE, seguindo o mesmo padrão. */
export function buildDanfeFileName(doc: XmlNaming): string {
  return buildXmlFileName(doc).replace(/\.xml$/i, ".pdf");
}

/**
 * Pretty print puramente textual (sem DOMParser), preservando o conteúdo:
 * apenas insere quebras de linha e indentação entre tags.
 */
export function formatXml(xml: string, indent = "  "): string {
  const normalized = xml
    .replace(/\r\n?/g, "\n")
    .replace(/>\s*</g, "><")
    .trim();

  const tokens = normalized.replace(/></g, ">\n<").split("\n");
  let depth = 0;
  const lines: string[] = [];

  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;
    const isClosing = /^<\//.test(t);
    const isSelfContained =
      /^<[^!?][^>]*>[^<]*<\/[^>]+>$/.test(t) || /\/>$/.test(t);
    const isDeclaration = /^<[?!]/.test(t);
    const isOpening =
      /^<[^/!?]/.test(t) && !isSelfContained && !isDeclaration;

    if (isClosing) depth = Math.max(0, depth - 1);
    lines.push(indent.repeat(depth) + t);
    if (isOpening) depth += 1;
  }

  return lines.join("\n");
}

/** Baixa um arquivo garantindo download (nunca abre no navegador). */
export async function downloadFile(url: string, fileName: string): Promise<void> {
  let objectUrl: string | null = null;
  let href = url;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    objectUrl = URL.createObjectURL(blob);
    href = objectUrl;
  } catch {
    // Fallback: usa a URL assinada direto com o atributo download.
    href = url;
  }

  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

/** Baixa texto já em memória (usado pelo modal de visualização). */
export function downloadText(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
