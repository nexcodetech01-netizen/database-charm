import { formatCurrency } from "@/lib/format";
import {
  CASH_METHOD_LABEL,
  type CashPaymentMethodKey,
  type CashSession,
  type CashSummary,
} from "../types";
import { normalizeMethod } from "../services/cash.service";

const METHOD_ORDER: CashPaymentMethodKey[] = [
  "cash",
  "pix",
  "credit_card",
  "debit_card",
  "payment_link",
];

function methodLabel(raw: string | null): string {
  const key = normalizeMethod(raw);
  return key === "other" ? "Outro" : CASH_METHOD_LABEL[key];
}

function fmtDate(v: string | null | undefined): string {
  return v ? new Date(v).toLocaleString("pt-BR") : "—";
}

/**
 * Gera PDF do relatório de fechamento de caixa espelhando exatamente o
 * conteúdo de <SessionReport />. Apenas leitura — não recalcula nada.
 */
export async function exportSessionReportPDF(
  session: CashSession,
  summary: CashSummary,
  companyName: string,
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  doc.setFontSize(14);
  doc.text(companyName, pageWidth / 2, 40, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text("Relatório de Fechamento de Caixa", pageWidth / 2, 56, { align: "center" });
  doc.setTextColor(0);

  const info: [string, string][] = [
    ["Operador", session.operator_name ?? "—"],
    ["Status", session.status === "closed" ? "Fechado" : "Aberto"],
    ["Aberto em", fmtDate(session.opened_at)],
    ["Fechado em", fmtDate(session.closed_at)],
  ];
  autoTable(doc, {
    startY: 72,
    body: info,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { textColor: 110, cellWidth: 90 }, 1: { fontStyle: "bold" } },
  });

    const nextY = () =>
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 72) + 24;

  const sectionTitle = (title: string) => {
    const y = nextY();
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(title, marginX, y);
    return y + 6;
  };

  const byMethodRows = (bm: CashSummary["byMethod"]): [string, string][] => {
    const rows: [string, string][] = METHOD_ORDER.map((k) => [
      CASH_METHOD_LABEL[k],
      `${bm[k].count}x   ${formatCurrency(bm[k].total)}`,
    ]);
    if (bm.other.count > 0) {
      rows.push(["Outros", `${bm.other.count}x   ${formatCurrency(bm.other.total)}`]);
    }
    return rows;
  };

  // ---------------------------------------------------------------- Bloco A
  let y = sectionTitle(`A. Vendas da sessão (${summary.salesCount})`);
  autoTable(doc, {
    startY: y,
    head: [["Resumo", ""]],
    body: [
      ["Quantidade", String(summary.salesCount)],
      ["Valor total", formatCurrency(summary.salesTotal)],
      ...byMethodRows(summary.byMethod),
    ] as [string, string][],
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 1: { halign: "right" } },
  });

  autoTable(doc, {
    startY: nextY() - 14,
    head: [["Venda", "Data/hora", "Forma", "Valor"]],
    body:
      summary.sales.length > 0
        ? summary.sales.map((s) => [
            s.number ?? s.id.slice(0, 8),
            fmtDate(s.paid_at),
            methodLabel(s.payment_method),
            formatCurrency(s.grand_total),
          ])
        : [["—", "—", "Nenhuma venda na sessão", "—"]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 3: { halign: "right" } },
  });

  // ---------------------------------------------------------------- Bloco B
  y = sectionTitle(`B. Recebimentos da sessão (${summary.receipts.length})`);
  autoTable(doc, {
    startY: y,
    head: [["Resumo", ""]],
    body: [
      ["Quantidade", String(summary.receipts.length)],
      ["Valor total", formatCurrency(summary.receiptsTotal)],
      ...byMethodRows(summary.receiptsByMethod),
    ] as [string, string][],
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [22, 163, 74] },
    columnStyles: { 1: { halign: "right" } },
  });

  autoTable(doc, {
    startY: nextY() - 14,
    head: [["Descrição", "Origem", "Data/hora", "Forma", "Valor"]],
    body:
      summary.receipts.length > 0
        ? summary.receipts.map((r) => [
            r.description ?? "—",
            r.source ?? "—",
            fmtDate(r.paid_at),
            methodLabel(r.payment_method),
            formatCurrency(Number(r.amount ?? 0)),
          ])
        : [["Nenhum recebimento na sessão", "—", "—", "—", "—"]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [22, 163, 74] },
    columnStyles: { 4: { halign: "right" } },
  });

  // ---------------------------------------------------------------- Bloco C
  y = sectionTitle(`C. Movimentações de caixa (${summary.movements.length})`);
  const diff = Number(session.difference ?? 0);
  const cashRows: [string, string][] = [
    ["Saldo inicial", formatCurrency(summary.openingBalance)],
    ["Vendas em dinheiro (A)", formatCurrency(summary.cashSales)],
    ["Recebimentos em dinheiro (B)", formatCurrency(summary.cashReceipts)],
    ["Suprimentos manuais", formatCurrency(summary.cashIn)],
    ["Sangrias manuais", `- ${formatCurrency(summary.cashOut)}`],
    [
      "Dinheiro esperado",
      formatCurrency(Number(session.expected_cash ?? summary.expectedCash)),
    ],
  ];
  if (summary.settlementMovementsTotal !== 0) {
    cashRows.push([
      "Baixas financeiras (informativo, não somam)",
      formatCurrency(summary.settlementMovementsTotal),
    ]);
  }
  if (session.counted_cash != null) {
    cashRows.push(["Dinheiro contado", formatCurrency(Number(session.counted_cash))]);
    cashRows.push(["Diferença", formatCurrency(diff)]);
  }
  autoTable(doc, {
    startY: y,
    head: [["Conferência de dinheiro", ""]],
    body: cashRows,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [217, 119, 6] },
    columnStyles: { 1: { halign: "right" } },
  });

  autoTable(doc, {
    startY: nextY() - 14,
    head: [["Tipo", "Origem", "Data/hora", "Motivo", "Valor"]],
    body:
      summary.movements.length > 0
        ? summary.movements.map((m) => [
            m.type === "cash_in" ? "Suprimento" : "Sangria",
            summary.settlementMovements.some((s) => s.id === m.id)
              ? "Baixa financeira"
              : "Manual",
            fmtDate(m.created_at),
            `${m.reason ?? "—"}${m.note ? ` — ${m.note}` : ""}`,
            formatCurrency(Number(m.amount ?? 0)),
          ])
        : [["—", "—", "—", "Nenhuma movimentação na sessão", "—"]],
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [217, 119, 6] },
    columnStyles: { 4: { halign: "right" } },
  });

  if (session.closing_note) {
    const y =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? 100;
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text("Observação:", marginX, y + 20);
    doc.setTextColor(80);
    doc.text(doc.splitTextToSize(session.closing_note, pageWidth - marginX * 2), marginX, y + 34);
    doc.setTextColor(0);
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Documento não fiscal • NexOS • Página ${i}/${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" },
    );
  }

  const openedIso = session.opened_at
    ? new Date(session.opened_at).toISOString().slice(0, 10)
    : "sessao";
  doc.save(`fechamento-caixa-${openedIso}.pdf`);
}
