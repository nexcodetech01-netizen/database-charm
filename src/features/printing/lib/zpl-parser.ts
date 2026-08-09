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
  let width = 4;
  let height = 6;
  let dpmm: 8 | 12 = 8;
  
  // ^PW = Print Width
  const pwMatch = zpl.match(/\^PW(\d+)/);
  if (pwMatch) {
    const dots = parseInt(pwMatch[1]);
    if (dots > 1000) width = dots / (dpmm * 25.4); // Aprox polegadas
    else if (dots > 600) width = 4;
  }

  // ^LL = Label Length
  const llMatch = zpl.match(/\^LL(\d+)/);
  if (llMatch) {
    const dots = parseInt(llMatch[1]);
    if (dots > 1800) height = dots / (dpmm * 25.4);
    else if (dots > 1000) height = 6;
  }

  // Identificação por conteúdo para DANFE (A4 geralmente)
  const isDanfe = zpl.includes("DANFE") || zpl.includes("Simplificada") || zpl.includes("Auxiliar");
  if (isDanfe) {
    width = 8;
    height = 11;
  }

  return { 
    width: Math.round(width), 
    height: Math.round(height), 
    dpmm,
    orientation: width > height ? "landscape" : "portrait"
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
