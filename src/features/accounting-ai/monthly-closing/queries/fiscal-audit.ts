import { 
  AccountingSummary,
} from "../../types";
import { 
  MonthlyClosingAudit, 
  MonthlyClosingChecklistItem, 
  MonthlyClosingHealthScore 
} from "../types";
import { AuditFiscalDocumentRow, AuditProductRow } from "../../services/ports";

/**
 * Motor de Auditoria Fiscal do Fechamento Mensal (Sprint 8.3C).
 * 
 * LEITURA PURA: Consome o AccountingSummary e os dados de auditoria fiscal 
 * para gerar o checklist, score e resumo fiscal.
 */
export function auditFiscalClosing(
  summary: AccountingSummary,
  fiscalDocs: AuditFiscalDocumentRow[],
  products: AuditProductRow[],
  month: string
): MonthlyClosingAudit {
  const checklist: MonthlyClosingChecklistItem[] = [];
  const timeline: any[] = [];
  
  // 1. Validar Documentos Fiscais (NFC-e / NF-e)
  const rejectedDocs = fiscalDocs.filter(d => d.status === 'rejected' || d.status === 'error');
  const pendingDocs = fiscalDocs.filter(d => d.status === 'pending' || d.status === 'waiting');
  
  if (rejectedDocs.length > 0) {
    checklist.push({
      id: "fisc_rejected",
      domain: "fiscal",
      title: "Documentos Rejeitados",
      status: "error",
      message: `Existem ${rejectedDocs.length} documentos fiscais rejeitados que precisam de atenção.`
    });
    
    rejectedDocs.forEach(doc => {
      timeline.push({
        date: new Date().toISOString(),
        domain: "fiscal",
        event: `Nota nº ${doc.number || 'S/N'} rejeitada: ${doc.rejectionReason || 'Erro desconhecido'}.`,
        type: "error"
      });
    });
  } else {
    checklist.push({
      id: "fisc_rejected_ok",
      domain: "fiscal",
      title: "Documentos Rejeitados",
      status: "success",
      message: "Nenhum documento fiscal rejeitado identificado."
    });
  }

  if (pendingDocs.length > 0) {
    checklist.push({
      id: "fisc_pending",
      domain: "fiscal",
      title: "Documentos Pendentes",
      status: "warning",
      message: `Existem ${pendingDocs.length} documentos fiscais aguardando processamento.`
    });
  }

  // 2. Validar Disponibilidade de XML/DANFE
  const missingFiles = fiscalDocs.filter(d => d.status === 'authorized' && (!d.xmlAuthorizedPath || !d.danfePath));
  if (missingFiles.length > 0) {
    checklist.push({
      id: "fisc_missing_files",
      domain: "fiscal",
      title: "Arquivos Fiscais",
      status: "warning",
      message: `${missingFiles.length} notas autorizadas estão sem XML ou DANFE disponível.`
    });
  }

  // 3. Validar Cadastro de Produtos (NCM/CFOP/Impostos)
  const productsMissingNcm = products.filter(p => !p.ncm || p.ncm.trim() === '');
  if (productsMissingNcm.length > 0) {
    checklist.push({
      id: "fisc_missing_ncm",
      domain: "fiscal",
      title: "Produtos sem NCM",
      status: "error",
      message: `${productsMissingNcm.length} produtos ativos estão sem NCM cadastrado.`
    });
  }

  // 4. Score Fiscal (0-100)
  // Penalidades por itens críticos
  let score = 100;
  if (rejectedDocs.length > 0) score -= 30;
  if (productsMissingNcm.length > 0) score -= 20;
  if (pendingDocs.length > 0) score -= 10;
  if (missingFiles.length > 0) score -= 5;
  score = Math.max(0, score);

  const healthScore: MonthlyClosingHealthScore = {
    score,
    level: score >= 90 ? "Excelente" : score >= 70 ? "Boa" : score >= 40 ? "Atenção" : "Crítica",
    label: score >= 90 
      ? "Sua conformidade fiscal está excelente." 
      : score >= 70 
        ? "Conformidade fiscal boa, mas com pequenos pontos de atenção." 
        : "Atenção: existem pendências fiscais que podem impactar o fechamento."
  };

  // Resumo
  const problems = checklist.filter(i => i.status === "error" || i.status === "warning").map(i => i.message || i.title);
  
  return {
    month,
    healthScore,
    checklist,
    summary: {
      monthSummary: `Auditoria fiscal de ${month}. ${healthScore.label}`,
      achievements: rejectedDocs.length === 0 && productsMissingNcm.length === 0 ? ["Conformidade com cadastros básicos"] : [],
      problems,
      biggestRisk: rejectedDocs.length > 0 ? "Notas rejeitadas podem gerar multas ou atrasos." : "Regularidade fiscal mantida.",
      biggestOpportunity: productsMissingNcm.length > 0 ? "Saneamento de cadastro de produtos para automação fiscal." : "Manter o fluxo de emissão atual.",
      finalRecommendation: score >= 70 ? "Fiscal pronto para o fechamento." : "Corrija as rejeições e cadastros antes de fechar o mês."
    },
    timeline
  };
}
