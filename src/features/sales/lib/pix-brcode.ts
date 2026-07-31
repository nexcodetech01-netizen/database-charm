/**
 * PIX "PIX Próprio" — gerador de BR Code estático (EMV).
 *
 * Especificação: Manual BR Code (Bacen) — payload EMV compatível com
 * qualquer app bancário. Uso: PIX estático recebido diretamente na conta
 * do lojista (sem intermediário como Asaas).
 *
 * Referência: https://www.bcb.gov.br/estabilidadefinanceira/pix (Manual BR Code v2).
 */

function tag(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/**
 * Sanitiza texto conforme especificação EMV: sem acentos, apenas ASCII imprimível,
 * uppercase quando aplicável (nome/cidade do recebedor).
 */
function sanitize(input: string, maxLen: number): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .trim()
    .slice(0, maxLen)
    .toUpperCase();
}

/**
 * CRC16-CCITT (poly 0x1021, init 0xFFFF) — algoritmo oficial exigido pelo BR Code.
 */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixBRCodeInput {
  pixKey: string;
  recipientName: string;
  recipientCity: string;
  amount: number;
  /** Opcional — 1..25 chars alfanuméricos. Ex.: número da venda. */
  txid?: string;
  /** Opcional — descrição curta exibida em alguns apps. */
  description?: string;
}

/**
 * Gera o payload BR Code (copia-e-cola) para PIX estático.
 * Retorna a string EMV pronta para ser exibida como QR e copiada.
 */
export function generatePixBRCode(input: PixBRCodeInput): string {
  const key = input.pixKey.trim();
  if (!key) throw new Error("Chave PIX obrigatória.");

  const name = sanitize(input.recipientName || "RECEBEDOR", 25);
  const city = sanitize(input.recipientCity || "BRASIL", 15);
  const amount = Number.isFinite(input.amount) && input.amount > 0
    ? input.amount.toFixed(2)
    : "";
  const txid = (input.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  // Merchant Account Information (id 26) — GUI + chave PIX + descrição opcional
  const gui = tag("00", "br.gov.bcb.pix");
  const keyTag = tag("01", key);
  const descTag = input.description
    ? tag("02", sanitize(input.description, 40))
    : "";
  const merchantAccount = tag("26", `${gui}${keyTag}${descTag}`);

  const additional = tag("62", tag("05", txid));

  let payload =
    tag("00", "01") + // Payload Format Indicator
    tag("01", "11") + // Point of Initiation — 11 = estático
    merchantAccount +
    tag("52", "0000") + // Merchant Category Code
    tag("53", "986") +  // Currency (BRL)
    (amount ? tag("54", amount) : "") +
    tag("58", "BR") +
    tag("59", name) +
    tag("60", city) +
    additional +
    "6304"; // CRC placeholder

  const crc = crc16(payload);
  payload = payload + crc;
  return payload;
}
