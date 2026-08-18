import * as pdfjsLib from "pdfjs-dist";

// O worker do pdf.js precisa ser carregado via URL — usamos o CDN
// oficial na mesma versão instalada, evitando complicação de bundler
// pra um arquivo que só roda em background.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Converte a primeira página de um PDF (por URL) numa imagem PNG em
 * base64, pronta pra imprimir via `/print/image` do Print Bridge.
 *
 * Por quê: a etiqueta de transportadora (Superfrete) vem como PDF, mas
 * a impressora térmica (mesma usada pro Mercado Livre) já teve
 * problema pra imprimir formatos "crus" direto (ZPL não funcionava —
 * só passou a funcionar depois de converter pra imagem e imprimir via
 * driver normal do Windows). Pra não arriscar o mesmo problema com
 * PDF, convertemos pra imagem aqui também, reaproveitando o mesmo
 * caminho de impressão já validado (`/print/image`).
 */
export async function convertPdfToImage(pdfUrl: string): Promise<string> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Não foi possível baixar o PDF da etiqueta (status ${response.status})`);
  }
  const pdfData = await response.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const page = await pdf.getPage(1);

  // Escala pensada pra qualidade boa numa impressora térmica sem gerar
  // uma imagem gigante à toa — o dimensionamento físico real (100x150mm)
  // é resolvido no script de impressão do Bridge, não aqui.
  const scale = 3;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível preparar a conversão da etiqueta.");
  }

  await page.render({ canvasContext: context, viewport, canvas } as any).promise;

  return canvas.toDataURL("image/png");
}
