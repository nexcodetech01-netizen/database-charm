import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/format";
import { Consignment, ConsignmentItem } from "../types";

// Extensão de tipos para o jsPDF com autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const generateConsignmentPDF = async (consignment: Consignment, items: ConsignmentItem[], companyName: string = "NexOS ERP") => {
  const doc = new jsPDF() as jsPDFWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Cabeçalho
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text("CONTRATO DE CONSIGNACAO DE MERCADORIAS", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.text(`N Identification: ${consignment.id.split('-')[0].toUpperCase()}`, pageWidth - margin, 28, { align: "right" });

  // 1. DADOS DAS PARTES
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("1. DAS PARTES", margin, 40);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Consignante (Empresa)
  doc.setFont("helvetica", "bold");
  doc.text("CONSIGNANTE:", margin, 48);
  doc.setFont("helvetica", "normal");
  doc.text(`${companyName}`, margin + 35, 48);
  
  // Consignatário (Revendedor)
  doc.setFont("helvetica", "bold");
  doc.text("CONSIGNATARIO:", margin, 56);
  doc.setFont("helvetica", "normal");
  doc.text(`${consignment.reseller?.name || "N/A"}`, margin + 35, 56);
  
  if (consignment.reseller?.document) {
    doc.setFont("helvetica", "bold");
    doc.text("CPF/CNPJ:", margin, 61);
    doc.setFont("helvetica", "normal");
    doc.text(`${consignment.reseller.document}`, margin + 35, 61);
  }
  
  if (consignment.reseller?.address) {
    doc.setFont("helvetica", "bold");
    doc.text("ENDERECO:", margin, 66);
    doc.setFont("helvetica", "normal");
    doc.text(`${consignment.reseller.address}`, margin + 35, 66);
  }

  // 2. DOS ITENS CONSIGNADOS
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("2. DOS ITENS CONSIGNADOS", margin, 80);

  const tableData = items.map((item) => [
    item.product?.sku || "-",
    item.product?.name || "Produto nao identificado",
    item.sent_quantity.toString(),
    formatCurrency(item.suggested_price || 0),
    formatCurrency(item.sent_quantity * (item.suggested_price || 0))
  ]);

  const totalValue = items.reduce((acc, item) => acc + (item.sent_quantity * (item.suggested_price || 0)), 0);

  doc.autoTable({
    startY: 85,
    head: [["SKU", "Descricao do Produto", "Qtd", "Preco Sug.", "Total"]],
    body: tableData,
    foot: [["", "VALOR TOTAL CONSIGNADO", "", "", formatCurrency(totalValue)]],
    theme: "striped",
    headStyles: { fillStyle: [40, 40, 40], textColor: 255 },
    footStyles: { fillStyle: [240, 240, 240], textColor: 40, fontStyle: "bold" },
    margin: { left: margin, right: margin }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 150;

  // 3. CLÁUSULAS
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("3. DAS CONDICOES E CLAUSULAS", margin, finalY + 15);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const clauses = [
    `3.1. O prazo para acerto de contas inicia-se em ${format(new Date(consignment.sent_at), "dd/MM/yyyy", { locale: ptBR })}.`,
    `3.2. A comissao acordada para o CONSIGNATARIO e de ${consignment.commission_type === 'percentual' ? consignment.commission_value + '%' : formatCurrency(consignment.commission_value)} por item vendido.`,
    "3.3. O CONSIGNATARIO assume total responsabilidade pela guarda e conservacao das mercadorias, respondendo por eventuais danos ou extravios.",
    "3.4. As mercadorias nao vendidas deverao ser devolvidas em perfeito estado no momento do acerto.",
    "3.5. O pagamento das mercadorias vendidas devera ser realizado imediatamente apos o encerramento do periodo de consignacao."
  ];

  let yPos = finalY + 22;
  clauses.forEach(clause => {
    const lines = doc.splitTextToSize(clause, pageWidth - (margin * 2));
    doc.text(lines, margin, yPos);
    yPos += (lines.length * 5);
  });

  // 4. ASSINATURAS
  const signatureY = yPos + 25;
  
  doc.line(margin, signatureY, margin + 80, signatureY);
  doc.text("CONSIGNANTE", margin + 40, signatureY + 5, { align: "center" });
  
  doc.line(pageWidth - margin - 80, signatureY, pageWidth - margin, signatureY);
  doc.text("CONSIGNATARIO", pageWidth - margin - 40, signatureY + 5, { align: "center" });

  doc.setFontSize(8);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });

  return doc.output("blob");
};
