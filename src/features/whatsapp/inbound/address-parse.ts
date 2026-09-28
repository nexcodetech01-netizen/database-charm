/**
 * Extrai CEP, logradouro, número e complemento de um endereço digitado
 * livremente pelo cliente no WhatsApp.
 *
 * BUG CORRIGIDO (2026-09-28): o parser antigo pegava o primeiro número
 * depois da vírgula. Em "Frederico Melle 145, 17607100" isso era o CEP,
 * que virava o número da casa — e o 145 ficava perdido no nome da rua.
 * Resultado: pedidos de entrega chegavam sem o número.
 */

export interface ParsedAddress {
  street: string;
  number: string | null;
  zipCode: string | null;
  complement: string | null;
}

// CEP: 8 dígitos, com ou sem hífen/ponto, isolado de outros dígitos.
const ZIP_RE = /(?<!\d)(\d{2}\.?\d{3})-?(\d{3})(?!\d)/;
const CEP_WORD_RE = /\bcep\b\s*:?/gi;
// Número explícito: "nº 145", "n. 145", "número 145".
const EXPLICIT_NUMBER_RE = /\b(?:n[º°o]|n\.|n[uú]mero)\s*:?\s*(\d{1,6}[a-z]?)\b/i;
const NO_NUMBER_RE = /\bs\/?n\b|\bsem\s+n[uú]mero\b/i;
// Complemento: do marcador em diante ("apto 12", "bloco B", "fundos").
const COMPLEMENT_RE =
  /(?:^|[\s,;-])((?:apto|apt|ap|apartamento|bloco|bl|sala|fundos|casa\s+\d|lote|lt|quadra|qd)\b.*)$/i;

function cleanPiece(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s,;.\-–—]+|[\s,;.\-–—]+$/g, "")
    .trim();
}

export function parseAddressText(input: string): ParsedAddress {
  let text = ` ${input ?? ""} `;

  // 1) CEP
  let zipCode: string | null = null;
  const zipMatch = text.match(ZIP_RE);
  if (zipMatch) {
    zipCode = `${zipMatch[1].replace(".", "")}${zipMatch[2]}`;
    text = text.replace(zipMatch[0], " ");
  }
  text = text.replace(CEP_WORD_RE, " ");

  // 2) Complemento
  let complement: string | null = null;
  const complementMatch = text.match(COMPLEMENT_RE);
  if (complementMatch && complementMatch.index !== undefined) {
    complement = cleanPiece(complementMatch[1]) || null;
    text = text.slice(0, complementMatch.index);
  }

  // 3) Número
  let number: string | null = null;
  const explicit = text.match(EXPLICIT_NUMBER_RE);
  if (explicit) {
    number = explicit[1].toUpperCase();
    text = text.replace(explicit[0], " ");
  } else if (NO_NUMBER_RE.test(text)) {
    number = "S/N";
    text = text.replace(NO_NUMBER_RE, " ");
  } else {
    // Último número isolado. Ignora números que fazem parte do nome da
    // rua, como "7 de Setembro" / "15 de Novembro".
    const candidates = [...text.matchAll(/(?<=^|[\s,])(\d{1,6}[a-z]?)(?=$|[\s,;])/gi)].filter(
      (m) => !/^\s+d[aeo]s?\s/i.test(text.slice((m.index ?? 0) + m[0].length)),
    );
    const last = candidates.at(-1);
    if (last && last.index !== undefined) {
      number = last[1].toUpperCase();
      text = text.slice(0, last.index) + " " + text.slice(last.index + last[0].length);
    }
  }

  return {
    street: cleanPiece(text),
    number,
    zipCode,
    complement,
  };
}
