import { MonthlyClosingAudit } from "../types";

export function consolidateMonthlyAudit(audits: {
  finance: MonthlyClosingAudit;
  fiscal: MonthlyClosingAudit;
  inventory: MonthlyClosingAudit;
  purchases: MonthlyClosingAudit;
  sales: MonthlyClosingAudit;
  cash: MonthlyClosingAudit;
}, month: string): MonthlyClosingAudit {
  const allAudits = [
    audits.finance,
    audits.fiscal,
    audits.inventory,
    audits.purchases,
    audits.sales,
    audits.cash
  ];

  // Reutiliza scores individuais sem recalcular
  const avgScore = Math.round(
    allAudits.reduce((acc, a) => acc + a.healthScore.score, 0) / allAudits.length
  );

  const minScore = Math.min(...allAudits.map(a => a.healthScore.score));
  
  // Identifica domínios forte e fraco
  const sortedByScore = [...allAudits].sort((a, b) => b.healthScore.score - a.healthScore.score);
  const strongest = sortedByScore[0];
  const weakest = sortedByScore[sortedByScore.length - 1];

  // Unifica pendências e classifica por prioridade (status)
  const checklist = allAudits.flatMap(a => a.checklist).sort((a, b) => {
    const priority = { error: 0, warning: 1, pending: 2, success: 3 };
    return priority[a.status] - priority[b.status];
  });

  // Timeline única e cronológica
  const timeline = allAudits
    .flatMap(a => a.timeline)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Resumo Executivo Consolidado
  const problems = allAudits.flatMap(a => a.summary.problems);
  const achievements = allAudits.flatMap(a => a.summary.achievements);
  
  // Seleciona o maior risco e oportunidade baseado nos piores/melhores setores
  const biggestRisk = weakest.summary.biggestRisk;
  const biggestOpportunity = strongest.summary.biggestOpportunity;

  // Lógica de Certificação (Sprint 8.3I)
  const criticalIssues = checklist.filter(c => c.status === 'error').length;
  const warningIssues = checklist.filter(c => c.status === 'warning').length;
  
  let certificationStatus: "Empresa apta" | "Empresa apta com ressalvas" | "Empresa não apta" = "Empresa apta";
  if (criticalIssues > 0 || avgScore < 40) {
    certificationStatus = "Empresa não apta";
  } else if (warningIssues > 0 || avgScore < 70) {
    certificationStatus = "Empresa apta com ressalvas";
  }

  return {
    month,
    healthScore: {
      score: avgScore,
      level: avgScore >= 90 ? "Excelente" : avgScore >= 70 ? "Boa" : avgScore >= 40 ? "Atenção" : "Crítica",
      label: `Saúde Geral: ${avgScore}/100. Domínio mais forte: ${strongest.healthScore.label.split('.')[0]}. Domínio mais fraco: ${weakest.healthScore.label.split('.')[0]}.`
    },
    checklist,
    summary: {
      monthSummary: `Resumo executivo de ${month}. A empresa apresenta um score geral de ${avgScore}. O setor de maior atenção é ${weakest.checklist[0]?.domain || 'desconhecido'}.`,
      achievements,
      problems,
      biggestRisk,
      biggestOpportunity,
      finalRecommendation: certificationStatus === "Empresa não apta" 
        ? `Empresa não está pronta. Resolver primeiro as ${criticalIssues} pendências críticas.`
        : certificationStatus === "Empresa apta com ressalvas"
        ? `Empresa pronta para iniciar o fechamento mensal com ressalvas. Atenção aos pontos médios.`
        : `Empresa pronta para iniciar o fechamento mensal. Todos os domínios em conformidade.`,
      certificationStatus,
      certifiedAt: new Date().toISOString()
    },
    timeline
  };
}
