import Papa from "papaparse";

export type Row = Record<string, string | number | null | undefined>;

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportCSV(filename: string, rows: Row[]) {
  const csv = Papa.unparse(rows, { quotes: true });
  download(`${filename}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8;" }));
}

export async function exportXLSX(filename: string, rows: Row[]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  download(`${filename}.xlsx`, new Blob([out], { type: "application/octet-stream" }));
}

export async function exportPDF(filename: string, title: string, rows: Row[]) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(new Date().toLocaleString("pt-BR"), 14, 22);

  if (rows.length === 0) {
    doc.text("Sem dados no período selecionado.", 14, 32);
  } else {
    const headers = Object.keys(rows[0]);
    autoTable(doc, {
      head: [headers],
      body: rows.map((r) => headers.map((h) => (r[h] ?? "").toString())),
      startY: 28,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] }, // primary
      alternateRowStyles: { fillColor: [248, 250, 252] }, // background
    });
  }
  doc.save(`${filename}.pdf`);
}
