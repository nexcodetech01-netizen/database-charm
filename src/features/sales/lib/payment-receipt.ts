/**
 * Comprovante de recebimento (baixa de venda / pagamento de crediário).
 * Parte pura: monta as linhas do cupom térmico e o texto do WhatsApp.
 */
import { paymentMethodLabel } from "./whatsapp-receipt";

export interface PaymentReceiptData {
  storeName: string;
  storeDoc?: string | null;
  storePhone?: string | null;
  customerName: string | null;
  saleNumber: string;
  paidAt: string; // ISO
  receivedAmount: number;
  paymentMethod: string | null;
  saleTotal: number;
  totalPaid: number;
  remaining: number;
  /** Próximas parcelas em aberto do crediário. */
  nextInstallments: { sequence: number; dueDate: string | null; amount: number }[];
}

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDay(isoDate: string | null): string {
  if (!isoDate) return "sem data";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function isSettled(data: Pick<PaymentReceiptData, "remaining">): boolean {
  return data.remaining <= 0.009;
}

/** Linhas [rótulo, valor] do cupom; valor vazio = linha de texto inteira. */
export function buildReceiptRows(data: PaymentReceiptData): {
  header: string[];
  rows: [string, string][];
  installments: [string, string][];
  footer: string[];
} {
  const header = [data.storeName, data.storeDoc ?? "", data.storePhone ?? ""].filter(Boolean);
  const rows: [string, string][] = [
    ["COMPROVANTE DE PAGAMENTO", ""],
    ["Data", fmtDate(data.paidAt)],
    ["Cliente", data.customerName ?? "Consumidor"],
    ["Venda", data.saleNumber],
    ["Valor recebido", brl(data.receivedAmount)],
    ["Forma", paymentMethodLabel(data.paymentMethod)],
    ["Total da venda", brl(data.saleTotal)],
    ["Já pago", brl(data.totalPaid)],
    [isSettled(data) ? "Situação" : "Falta pagar", isSettled(data) ? "QUITADO" : brl(data.remaining)],
  ];
  const installments: [string, string][] = isSettled(data)
    ? []
    : data.nextInstallments.map((i) => [`${i.sequence}ª parcela · ${fmtDay(i.dueDate)}`, brl(i.amount)]);
  const footer = ["Obrigado pela preferência!"];
  return { header, rows, installments, footer };
}

/** Texto do comprovante para o WhatsApp. */
export function buildReceiptWhatsappText(data: PaymentReceiptData): string {
  const lines = [
    `*${data.storeName}*`,
    "Comprovante de pagamento",
    "",
    `Venda: ${data.saleNumber}`,
    `Data: ${fmtDate(data.paidAt)}`,
    `Valor recebido: *${brl(data.receivedAmount)}* (${paymentMethodLabel(data.paymentMethod)})`,
    "",
    `Total da venda: ${brl(data.saleTotal)}`,
    `Já pago: ${brl(data.totalPaid)}`,
    isSettled(data) ? "Situação: *QUITADO* ✅" : `Falta pagar: *${brl(data.remaining)}*`,
  ];
  if (!isSettled(data) && data.nextInstallments.length > 0) {
    lines.push("", "Próximas parcelas:");
    for (const i of data.nextInstallments) {
      lines.push(`• ${i.sequence}ª parcela – ${fmtDay(i.dueDate)} – ${brl(i.amount)}`);
    }
  }
  lines.push("", "Obrigado pela preferência!");
  return lines.join("\n");
}

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** HTML autocontido do cupom térmico (estilos inline, sem depender do app). */
export function buildReceiptHtml(data: PaymentReceiptData, paperWidth: "58mm" | "80mm" = "80mm"): string {
  const { header, rows, installments, footer } = buildReceiptRows(data);
  const width = paperWidth === "58mm" ? 48 : 72;
  const row = ([label, value]: [string, string]) =>
    value
      ? `<tr><td>${esc(label)}</td><td class="v">${esc(value)}</td></tr>`
      : `<tr><td colspan="2" class="t">${esc(label)}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: ${paperWidth === "58mm" ? 58 : 80}mm auto; margin: 0; }
body { margin: 0; padding: 3mm; width: ${width}mm; font-family: 'Courier New', monospace; font-size: 11px; color: #000; background: #fff; }
.c { text-align: center; } .b { font-weight: bold; }
table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
td.v { text-align: right; white-space: nowrap; padding-left: 4px; }
td.t { text-align: center; font-weight: bold; padding: 4px 0; }
hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
</style></head><body>
${header.map((h, i) => `<div class="c${i === 0 ? " b" : ""}">${esc(h)}</div>`).join("")}
<hr><table>${rows.map(row).join("")}</table>
${installments.length ? `<hr><div class="b">Próximas parcelas</div><table>${installments.map(row).join("")}</table>` : ""}
<hr>${footer.map((f) => `<div class="c">${esc(f)}</div>`).join("")}
</body></html>`;
}
