import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

/**
 * Helpers de compartilhamento do checkout (WhatsApp / clipboard).
 * Funções puras, exceto `copyToClipboard` e `openWhatsApp`, que tocam o navegador.
 */

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

/**
 * Normaliza telefone para uso no wa.me (E.164 sem "+").
 * Considera padrão brasileiro (DDD + número) e prepende 55 quando ausente.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const digits = onlyDigits(phone);
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length === 12 || digits.length === 13) return digits;
  return digits.length >= 10 ? digits : null;
}

const greetingName = (name?: string | null) => name?.trim() || "cliente";

export function buildPixMessage(params: {
  customerName?: string | null;
  companyName?: string | null;
  amount: number;
  pixPayload: string;
}): string {
  const empresa = params.companyName?.trim() || "nossa loja";
  return [
    `Olá, ${greetingName(params.customerName)}!`,
    "",
    `Segue sua cobrança da ${empresa}.`,
    "",
    `Valor: ${formatCurrency(params.amount)}`,
    "",
    "PIX Copia e Cola:",
    params.pixPayload,
    "",
    "Caso prefira, utilize o QR Code exibido.",
    "",
    "Obrigado pela preferência!",
  ].join("\n");
}

export function buildLinkMessage(params: {
  customerName?: string | null;
  amount: number;
  paymentLink: string;
}): string {
  return [
    `Olá, ${greetingName(params.customerName)}!`,
    "",
    "Segue seu link para pagamento:",
    params.paymentLink,
    "",
    `Valor: ${formatCurrency(params.amount)}`,
    "",
    "Obrigado pela preferência!",
  ].join("\n");
}

export async function copyToClipboard(value: string, successLabel: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successLabel);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

export function openWhatsApp(phone: string, message: string): void {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
