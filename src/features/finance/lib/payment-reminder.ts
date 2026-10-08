import { formatCurrency } from "@/lib/format";
import { sanitizePhoneBR } from "@/features/sales/lib/whatsapp-receipt";

export interface PaymentReminderInput {
  customerName: string | null;
  storeName?: string | null;
  pixKey?: string | null;
  amount: number;
  /** yyyy-mm-dd */
  due: string | null;
  /** dias de atraso (negativo = ainda vai vencer) */
  daysLate: number;
}

function firstName(name: string | null): string {
  const n = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : "";
}

function shortDate(due: string | null): string {
  if (!due) return "";
  const [, m, d] = due.split("-");
  return d && m ? `${d}/${m}` : due;
}

/**
 * Texto do lembrete de pagamento. Tom gentil para quem ainda vai vencer,
 * direto (mas educado) para quem já venceu.
 */
export function buildPaymentReminder(input: PaymentReminderInput): string {
  const hi = firstName(input.customerName);
  const greeting = hi ? `Oi, ${hi}! Tudo bem?` : "Oi! Tudo bem?";
  const value = formatCurrency(Number(input.amount) || 0);
  const date = shortDate(input.due);
  const store = input.storeName?.trim() ? ` na ${input.storeName.trim()}` : "";

  let body: string;
  if (input.daysLate > 0) {
    body =
      `Passando para lembrar do pagamento de ${value}${store}, que venceu em ${date}. ` +
      `Consegue ver para nós? Se já pagou, desconsidere esta mensagem.`;
  } else if (input.daysLate === 0) {
    body = `Passando para lembrar que o pagamento de ${value}${store} vence hoje (${date}).`;
  } else {
    body = `Passando para lembrar que o pagamento de ${value}${store} vence em ${date}.`;
  }

  const pix = input.pixKey?.trim() ? `\n\nChave Pix: ${input.pixKey.trim()}` : "";
  return `${greeting}\n\n${body}${pix}\n\nQualquer dúvida, é só chamar. Obrigada!`;
}

/** Link do WhatsApp com a mensagem pronta; null se não houver telefone. */
export function paymentReminderLink(phone: string | null | undefined, message: string): string | null {
  const to = sanitizePhoneBR(phone ?? "");
  if (to.length < 12) return null;
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}
