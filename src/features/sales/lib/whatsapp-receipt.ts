import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { salesService } from "../services/sales.service";

const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  pix_manual: "Pix",
  cash: "Dinheiro",
  money: "Dinheiro",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  card: "Cartão",
  boleto: "Boleto",
  payment_link: "Link de Pagamento",
  bella_pay: "Bella Pay",
  transfer: "Transferência",
  bank_transfer: "Transferência Bancária",
  a_receber: "A Prazo / A Receber",
  crediario: "Crediário",
  credit_account: "Crediário",
  pending_payment: "Pendente",
  other: "Outros",
};

/** Converte um id técnico em rótulo amigável ("credit_card" → "Cartão de Crédito"). */
export function paymentMethodLabel(method?: string | null): string {
  const key = (method ?? "").trim().toLowerCase();
  if (!key) return "—";
  if (METHOD_LABEL[key]) return METHOD_LABEL[key];
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Remove caracteres de controle e símbolos corrompidos (mojibake / replacement char). */
export function cleanReceiptText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n");
}


/** Sanitiza para dígitos com DDI 55. */
export function sanitizePhoneBR(input: string): string {
  const d = (input ?? "").replace(/\D+/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return d;
  return `55${d}`;
}

export interface BuildReceiptMessageInput {
  saleId: string;
  companyId: string;
  paymentMethod?: string | null;
}

export interface BuiltReceiptMessage {
  message: string;
  customerPhone: string | null;
  customerName: string | null;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString("pt-BR");
}
function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export async function buildReceiptWhatsAppMessage(
  input: BuildReceiptMessageInput,
): Promise<BuiltReceiptMessage> {
  const sale = await salesService.get(input.saleId);
  if (!sale) throw new Error("Venda não encontrada.");

  const { data: company } = await supabase
    .from("companies")
    .select("trade_name, name")
    .eq("id", input.companyId)
    .maybeSingle();

  let customerPhone: string | null = null;
  let customerName: string | null = sale.customer_name ?? null;
  if (sale.customer_id) {
    const { data: c } = await supabase
      .from("customers")
      .select("name, phone, whatsapp")
      .eq("id", sale.customer_id)
      .maybeSingle();
    if (c) {
      customerName = c.name ?? customerName;
      const raw = (c.whatsapp || c.phone || "").toString().trim();
      customerPhone = raw ? sanitizePhoneBR(raw) : null;
    }
  }

  const brandName =
    company?.trade_name || company?.name || "CUPOM NÃO FISCAL";

  // Forma de pagamento efetiva: prioriza a baixa financeira já liquidada.
  const { data: settled } = await supabase
    .from("financial_transactions")
    .select("payment_method, status, paid_at")
    .eq("reference_id", input.saleId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1);

  const settlement = settled?.[0] ?? null;
  const isPaid = Boolean(settlement) || sale.status === "paid";
  const method =
    settlement?.payment_method ?? input.paymentMethod ?? sale.payment_method ?? null;
  const methodLabel = paymentMethodLabel(method);
  const statusLabel = isPaid ? "Pago" : "Pagamento pendente";

  const itemsLines = sale.items
    .map((it) => {
      const qty = Number(it.quantity ?? 0);
      const unit = Number(it.unit_price ?? 0);
      const total = Number(it.total ?? qty * unit);
      return `• ${qty.toLocaleString("pt-BR")}x ${it.description} — ${formatCurrency(
        unit,
      )} (${formatCurrency(total)})`;
    })
    .join("\n");

  const subtotal = formatCurrency(Number(sale.items_total ?? 0));
  const total = formatCurrency(Number(sale.grand_total ?? 0));

  const message = cleanReceiptText(
    `🧾 *CUPOM NÃO FISCAL - ${brandName}*\n` +
      `--------------------------------\n` +
      `*Venda Nº:* ${sale.number ?? "—"}\n` +
      `*Data:* ${fmtDate(sale.sale_date ?? sale.created_at)} às ${fmtTime(sale.created_at)}\n` +
      `*Cliente:* ${customerName ?? "Consumidor"}\n\n` +
      `🛒 *ITENS*\n${itemsLines || "—"}\n\n` +
      `*Subtotal:* ${subtotal}\n` +
      `💰 *TOTAL:* ${total}\n` +
      `💳 *Pagamento:* ${methodLabel}\n` +
      `${isPaid ? "✅" : "⏳"} *Status:* ${statusLabel}\n` +
      `--------------------------------\n` +
      `Obrigado pela preferência! Volte sempre. 😊`,
  );

  return { message, customerPhone, customerName };

}

export function openWhatsAppWithMessage(phone: string, message: string) {
  const to = sanitizePhoneBR(phone);
  const url = `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
