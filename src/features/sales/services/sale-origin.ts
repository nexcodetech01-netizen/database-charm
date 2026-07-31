/**
 * Origem da venda (RC2 / P0.2).
 *
 * Ponto ÚNICO onde se decide se um fluxo pode gravar venda sem cliente.
 * A origem é sempre informada de forma explícita por quem chama
 * `salesService.create` — não existe variável global, inferência por número
 * da venda ou qualquer outro atalho.
 *
 * Regra de negócio:
 * - `pdv`  → venda de balcão / consumidor final: cliente OPCIONAL
 *            (a NFC-e modelo 65 emite sem identificação do destinatário).
 * - demais → cliente OBRIGATÓRIO para venda ativa, exatamente como hoje.
 */
export type SaleOrigin =
  | "pdv"
  | "sale_form"
  | "marketplace"
  | "api"
  | "assistant";

/** Fluxos que não informam origem seguem a regra tradicional. */
export const DEFAULT_SALE_ORIGIN: SaleOrigin = "sale_form";

/** Origens em que a venda pode existir sem cliente identificado. */
const ANONYMOUS_ALLOWED: ReadonlySet<SaleOrigin> = new Set<SaleOrigin>(["pdv"]);

/** Status que nunca exigiram cliente (rascunho e cancelada). */
const CUSTOMER_EXEMPT_STATUS = new Set(["draft", "cancelled"]);

/**
 * Regra compartilhada: esta venda exige cliente?
 * Usada exclusivamente pela validação do `salesService.create`.
 */
export function saleRequiresCustomer(
  origin: SaleOrigin = DEFAULT_SALE_ORIGIN,
  status?: string | null,
): boolean {
  if (ANONYMOUS_ALLOWED.has(origin)) return false;
  return !CUSTOMER_EXEMPT_STATUS.has(String(status ?? "pending").toLowerCase());
}
