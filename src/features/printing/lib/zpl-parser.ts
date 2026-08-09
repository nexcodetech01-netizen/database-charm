import { LabelData } from "../types/printing.types";

/**
 * Lógica centralizada para parsear e detectar dimensões de ZPL
 */

export interface ZPLDimensions {
  width: number;
  height: number;
  dpmm: 8 | 12;
  orientation: "portrait" | "landscape";
}

export function detectZPLDimensions(zpl: string): ZPLDimensions {
  let dotsW = 812;
  let dotsH = 1218;
  const dpmm: 8 | 12 = 8;
  
  const pwMatch = zpl.match(/\^PW(\d+)/);
  if (pwMatch) dotsW = parseInt(pwMatch[1]);

  const llMatch = zpl.match(/\^LL(\d+)/);
  if (llMatch) dotsH = parseInt(llMatch[1]);

  let width = dotsW / (dpmm * 25.4);
  let height = dotsH / (dpmm * 25.4);

  const isDanfe = zpl.includes("DANFE") || zpl.includes("Simplificada") || zpl.includes("Auxiliar");
  if (isDanfe) {
    width = 8;
    height = 11;
  }

  return { 
    width: Math.round(width * 10) / 10, 
    height: Math.round(height * 10) / 10, 
    dpmm,
    orientation: dotsW > dotsH ? "landscape" : "portrait"
  };
}

export function parseZPLBlocks(content: string) {
  const regex = /\^XA[\s\S]*?\^XZ/g;
  const matches = content.match(regex) || [];
  const validBlocks: Array<{ zpl: string; type: "label" | "danfe" }> = [];
  
  matches.forEach((zpl) => {
    const trimmed = zpl.trim();
    // Filtro de utilidade
    const isUseful = trimmed.includes('^FD') || trimmed.includes('^GF') || trimmed.includes('^B');
    if (trimmed.length < 50 || !trimmed.includes('^') || !isUseful) {
      return;
    }

    const isDanfe = zpl.includes("DANFE") || zpl.includes("Simplificada") || zpl.includes("Auxiliar");
    const type = isDanfe ? "danfe" : "label";
    
    // Deduplicação
    if (!validBlocks.some(b => b.zpl === zpl)) {
      validBlocks.push({ zpl, type });
    }
  });

  return validBlocks;
}
