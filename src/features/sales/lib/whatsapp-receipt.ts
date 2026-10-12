import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { salesService } from "../services/sales.service";
import { creditService } from "@/features/credit/services/credit.service";

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
  credit: "Crediário",
  credito: "Crediário",
  pending_payment: "Pagamento Pendente",
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
  // "2026-10-11" (só a data) não pode virar meia-noite UTC: no Brasil
  // isso mostra o dia anterior.
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("pt-BR");
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

  const brandName = company?.trade_name || company?.name || "CUPOM NÃO FISCAL";

  // Crediário: entrada, saldo e parcelas (igual ao cupom impresso).
  const credit = await creditService.getDetail(input.saleId).catch(() => null);

  // Forma de pagamento efetiva: prioriza a baixa financeira já liquidada.
  const { data: settled } = await supabase
    .from("financial_transactions")
    .select("payment_method, status, paid_at")
    .eq("reference_id", input.saleId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1);
  const settlement = settled?.[0] ?? null;

  const message = buildReceiptText({
    brandName,
    saleNumber: sale.number ?? null,
    date: sale.sale_date ?? sale.created_at,
    time: sale.created_at,
    customerName,
    items: sale.items.map((it) => ({
      quantity: Number(it.quantity ?? 0),
      description: String(it.description ?? ""),
      unitPrice: Number(it.unit_price ?? 0),
      total: Number(it.total ?? Number(it.quantity ?? 0) * Number(it.unit_price ?? 0)),
    })),
    subtotal: Number(sale.items_total ?? 0),
    discount: Number(sale.discount ?? 0),
    total: Number(sale.grand_total ?? 0),
    saleStatus: sale.status,
    paymentMethod: settlement?.payment_method ?? input.paymentMethod ?? sale.payment_method ?? null,
    hasSettlement: Boolean(settlement),
    credit: credit
      ? {
          downPayment: Number(credit.account.down_payment ?? 0),
          downPaymentMethod:
            credit.payments.find((p) => p.kind === "down_payment")?.payment_method ?? null,
          balance: Number(credit.account.balance ?? 0),
          installments: credit.installments
            .filter((i) => i.status !== "cancelled")
            .map((i) => ({
              sequence: Number(i.sequence),
              amount: Number(i.amount ?? 0),
              paid: Number(i.paid_amount ?? 0),
              dueDate: i.due_date ?? null,
            })),
        }
      : null,
  });

  return { message, customerPhone, customerName };
}

export interface ReceiptTextInput {
  brandName: string;
  saleNumber: string | null;
  date: string | null;
  time: string | null;
  customerName: string | null;
  items: { quantity: number; description: string; unitPrice: number; total: number }[];
  subtotal: number;
  discount: number;
  total: number;
  saleStatus: string | null;
  paymentMethod: string | null;
  hasSettlement: boolean;
  credit: {
    downPayment: number;
    downPaymentMethod: string | null;
    balance: number;
    installments: { sequence: number; amount: number; paid: number; dueDate: string | null }[];
  } | null;
}

function fmtDay(day: string | null) {
  if (!day) return "—";
  const [y, m, d] = day.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : day;
}

/**
 * Texto do cupom para o WhatsApp. Sem emojis: alguns aplicativos do
 * WhatsApp (principalmente o de computador) trocam os emojis vindos do
 * link por "�".
 */
export function buildReceiptText(r: ReceiptTextInput): string {
  const lines: string[] = [];
  lines.push(`*CUPOM NÃO FISCAL - ${r.brandName}*`);
  lines.push("--------------------------------");
  lines.push(`*Venda Nº:* ${r.saleNumber ?? "—"}`);
  lines.push(`*Data:* ${fmtDate(r.date)} às ${fmtTime(r.time)}`);
  lines.push(`*Cliente:* ${r.customerName ?? "Consumidor"}`);
  lines.push("");
  lines.push("*ITENS*");
  if (r.items.length === 0) lines.push("—");
  for (const it of r.items) {
    lines.push(
      `• ${it.quantity.toLocaleString("pt-BR")}x ${it.description} — ${formatCurrency(it.total)}`,
    );
  }
  lines.push("");
  lines.push(`Subtotal: ${formatCurrency(r.subtotal)}`);
  if (r.discount > 0.009) lines.push(`Desconto: - ${formatCurrency(r.discount)}`);
  lines.push(`*TOTAL: ${formatCurrency(r.total)}*`);
  lines.push("");

  if (r.credit) {
    const c = r.credit;
    lines.push("*Pagamento:* Crediário");
    if (c.downPayment > 0.009) {
      const how = c.downPaymentMethod ? ` (${paymentMethodLabel(c.downPaymentMethod)})` : "";
      lines.push(`Entrada${how}: ${formatCurrency(c.downPayment)}`);
    }
    if (c.balance > 0.009) {
      lines.push(`*Saldo a pagar: ${formatCurrency(c.balance)}*`);
      const open = c.installments.filter((i) => i.amount - i.paid > 0.009);
      if (open.length > 0) {
        lines.push("");
        lines.push("*Parcelas:*");
        for (const i of open) {
          lines.push(
            `${i.sequence}ª parcela: ${formatCurrency(i.amount - i.paid)} — vence ${fmtDay(i.dueDate)}`,
          );
        }
      }
    } else {
      lines.push("*Status:* Quitado");
    }
  } else {
    const isPaid = r.hasSettlement || r.saleStatus === "paid";
    const status = isPaid
      ? "Pago"
      : r.saleStatus === "partially_paid"
        ? "Pago em parte"
        : "Pagamento pendente";
    lines.push(`*Pagamento:* ${paymentMethodLabel(r.paymentMethod)}`);
    lines.push(`*Status:* ${status}`);
  }

  lines.push("--------------------------------");
  lines.push("Obrigado pela preferência! Volte sempre.");
  return cleanReceiptText(lines.join("\n"));
}

export function openWhatsAppWithMessage(phone: string, message: string) {
  const to = sanitizePhoneBR(phone);
  const url = `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
