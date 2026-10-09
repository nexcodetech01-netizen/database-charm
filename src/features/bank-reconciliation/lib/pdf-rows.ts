import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

/** Lê o texto do PDF no navegador e devolve as linhas (pedaços da esquerda para a direita). */
export async function extractPdfRows(file: File): Promise<string[][]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const rows: string[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lines = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items as { str?: string; transform?: number[] }[]) {
      const text = item.str?.trim();
      if (!text || !item.transform) continue;
      const y = Math.round(item.transform[5]);
      const key = [...lines.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!lines.has(key)) lines.set(key, []);
      const line = lines.get(key);
      if (line) line.push({ x: item.transform[4], text });
    }
    [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, items]) => rows.push(items.sort((a, b) => a.x - b.x).map((i) => i.text)));
  }
  return rows;
}
