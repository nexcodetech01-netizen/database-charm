/**
 * Chave anti-duplicata da criação de venda (`sales.client_request_id`).
 *
 * A mesma chave é reaproveitada enquanto o conteúdo da venda não mudar: se a
 * rede cair no meio do INSERT e o usuário tentar de novo, o banco reconhece a
 * venda já gravada pela chave (índice único por empresa) em vez de duplicar.
 * Se o carrinho mudar, gera-se uma chave nova — nunca se devolve uma venda
 * antiga com itens diferentes.
 */

export interface SaleFingerprintInput {
  customerId?: string | null;
  paymentMethod?: string | null;
  discount?: number | null;
  shipping?: number | null;
  items: ReadonlyArray<{
    product_id?: string | null;
    description?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    discount?: number | null;
  }>;
}

export function saleFingerprint(input: SaleFingerprintInput): string {
  return JSON.stringify([
    input.customerId ?? null,
    input.paymentMethod ?? null,
    Number(input.discount ?? 0),
    Number(input.shipping ?? 0),
    input.items.map((it) => [
      it.product_id ?? null,
      (it.description ?? "").trim(),
      Number(it.quantity ?? 0),
      Number(it.unit_price ?? 0),
      Number(it.discount ?? 0),
    ]),
  ]);
}

function randomId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback RFC4122 v4 (navegadores muito antigos).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface IdempotencyKeeper {
  /** Mesma chave para o mesmo conteúdo; chave nova quando o conteúdo muda. */
  keyFor(fingerprint: string): string;
  /** Chamar após a venda ser criada com sucesso (próxima venda = chave nova). */
  reset(): void;
}

export function createIdempotencyKeeper(newId: () => string = randomId): IdempotencyKeeper {
  let currentFingerprint: string | null = null;
  let currentKey: string | null = null;
  return {
    keyFor(fingerprint) {
      if (fingerprint !== currentFingerprint || !currentKey) {
        currentFingerprint = fingerprint;
        currentKey = newId();
      }
      return currentKey;
    },
    reset() {
      currentFingerprint = null;
      currentKey = null;
    },
  };
}

/** Nome do índice único criado na migration 20261022210000. */
export const SALE_CLIENT_REQUEST_UNIQUE = "sales_company_client_request_uidx";
/** Constraint UNIQUE(company_id, number) de `sales`. */
export const SALE_NUMBER_UNIQUE = "sales_company_id_number_key";
