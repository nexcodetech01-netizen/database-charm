/**
 * Payment events — presentation layer only.
 *
 * Broadcast when o NexOS confirma um pagamento (webhook PIX, cartão etc.)
 * para que o front exiba uma notificação não intrusiva.
 *
 * Uso pretendido:
 *   - Publisher: quando um canal realtime (a ser criado em sprint futura)
 *     detectar `sales.status → paid`, chama `emitPaymentConfirmed({...})`.
 *   - Subscriber: `usePaymentConfirmedListener` — montado uma vez no layout
 *     autenticado — exibe um toast persistente com ação "Ver venda".
 *
 * Não faz polling. Não cria canal. É apenas a infraestrutura de apresentação.
 */

export type PaymentConfirmedEvent = {
  saleId: string;
  saleNumber?: string;
  method?: string; // "pix" | "credit_card" | ...
  amount?: number;
};

type Listener = (e: PaymentConfirmedEvent) => void;

const listeners = new Set<Listener>();

export function onPaymentConfirmed(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitPaymentConfirmed(event: PaymentConfirmedEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch {
      // um listener quebrado não pode derrubar os outros
    }
  }
}
