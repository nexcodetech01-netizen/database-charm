import type { LabelData, PrintResult } from "../types/printing.types";

/**
 * Impressão pelo navegador — plano B quando o Print Bridge está desligado.
 *
 * Abre a janela de impressão do Chrome com a etiqueta já no tamanho certo
 * (10x15 por padrão). A pessoa escolhe a impressora térmica uma vez (o Chrome
 * lembra) e aperta Enter. Nada precisa estar instalado ou aberto.
 */

function printHtmlInFrame(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    const cleanup = () => setTimeout(() => frame.remove(), 60_000);
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) {
      frame.remove();
      reject(new Error("O navegador bloqueou a impressão."));
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const img = doc.querySelector("img");
    const go = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        resolve();
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      } finally {
        cleanup();
      }
    };
    if (img && !img.complete) {
      img.onload = go;
      img.onerror = () => {
        cleanup();
        reject(new Error("Não foi possível carregar a imagem da etiqueta."));
      };
    } else {
      setTimeout(go, 50);
    }
  });
}

function labelPage(src: string, widthIn: number, heightIn: number) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta</title>
<style>
  @page { size: ${widthIn}in ${heightIn}in; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  img { display: block; width: ${widthIn}in; height: ${heightIn}in; object-fit: contain; }
</style></head><body><img src="${src}" alt="Etiqueta"></body></html>`;
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function printInBrowser(label: LabelData): Promise<PrintResult> {
  if (typeof window === "undefined") return { success: false, message: "Impressão indisponível." };
  const width = label.width || 4;
  const height = label.height || 6;

  try {
    if (label.zpl) {
      const { labelaryService } = await import("./labelary.service");
      const png = await labelaryService.convertToPng(label);
      await printHtmlInFrame(labelPage(await blobToDataUrl(png), width, height));
      return { success: true, jobId: "browser", message: "Janela de impressão aberta." };
    }

    if (label.image) {
      await printHtmlInFrame(labelPage(label.image, width, height));
      return { success: true, jobId: "browser", message: "Janela de impressão aberta." };
    }

    if (label.pdf) {
      // PDF de outro site (ex.: SuperFrete): o navegador não deixa imprimir
      // direto de outra origem — abre numa aba para imprimir de lá.
      if (/^https?:\/\//i.test(label.pdf)) {
        window.open(label.pdf, "_blank", "noopener,noreferrer");
        return {
          success: true,
          jobId: "browser",
          message: "Etiqueta aberta numa nova aba — use Ctrl+P para imprimir.",
        };
      }
      const b64 = label.pdf.replace(/^data:.*;base64,/, "");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const w = window.open(url, "_blank");
      if (!w) return { success: false, message: "O navegador bloqueou a nova aba. Permita pop-ups para o NexOS." };
      return { success: true, jobId: "browser", message: "Etiqueta aberta numa nova aba — use Ctrl+P para imprimir." };
    }

    return { success: false, message: "Esse tipo de impressão precisa do Print Bridge ligado." };
  } catch (e) {
    return {
      success: false,
      message: `Não foi possível abrir a impressão no navegador: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
