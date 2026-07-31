/**
 * Fiscal v2 — Parser de rejeições SEFAZ (Sprint 007.3).
 *
 * Mapeia códigos frequentes do Manual de Orientação da SEFAZ
 * para mensagens acionáveis. Extrai o código quando presente no
 * `rejectionReason` no formato clássico "Rejeicao: 610 - ..." ou
 * "Rejeição: NNN".
 *
 * Fonte: NT2011/002 e MOC 7.0 (subset com maior incidência).
 */

export interface RejectionInfo {
  /** Código SEFAZ (3 dígitos) ou "VALIDATION" para rejeições internas. */
  code: string | null;
  /** Título curto e amigável. */
  title: string;
  /** Ação sugerida para o usuário. */
  action: string;
  /** Severidade: block = bloqueia emissão; retry = tente novamente. */
  severity: "block" | "retry";
}

const SEFAZ_MAP: Record<string, Omit<RejectionInfo, "code">> = {
  "204": {
    title: "Duplicidade de NF-e",
    action:
      "Já existe uma NF-e autorizada com esta chave. Consulte antes de reemitir.",
    severity: "block",
  },
  "217": {
    title: "NF-e não consta na base de dados da SEFAZ",
    action:
      "Aguarde alguns minutos e reenvie. Se persistir, verifique a chave.",
    severity: "retry",
  },
  "226": {
    title: "CFOP incompatível com a operação",
    action: "Ajuste o CFOP em Regras Fiscais (dentro/fora do estado).",
    severity: "block",
  },
  "227": {
    title: "Campo obrigatório não informado",
    action: "Revise os dados do destinatário e dos itens da NF-e.",
    severity: "block",
  },
  "233": {
    title: "IE do destinatário inválida",
    action:
      "Corrija a Inscrição Estadual do cliente ou marque como isento.",
    severity: "block",
  },
  "234": {
    title: "Inscrição Estadual do emitente inválida",
    action:
      "Confira a IE em Configuração → Dados da Empresa.",
    severity: "block",
  },
  "236": {
    title: "Chave de acesso com dígito verificador inválido",
    action: "Reemita a NF-e — a chave será recalculada.",
    severity: "retry",
  },
  "239": {
    title: "Versão do leiaute inválida",
    action: "Provedor desatualizado. Contate o suporte do provedor fiscal.",
    severity: "block",
  },
  "252": {
    title: "Ambiente da NF-e diverge do serviço",
    action:
      "Verifique se está emitindo em Produção usando URL de Homologação (ou vice-versa).",
    severity: "block",
  },
  "301": {
    title: "Uso denegado (destinatário irregular)",
    action:
      "Não é possível emitir para este CNPJ/CPF (situação irregular na SEFAZ).",
    severity: "block",
  },
  "302": {
    title: "Uso denegado (emitente irregular)",
    action:
      "Sua empresa está irregular na SEFAZ. Regularize antes de emitir novas NF-e.",
    severity: "block",
  },
  "539": {
    title: "Duplicidade de NF-e com diferença na chave de acesso",
    action:
      "Já existe NF-e com mesmo número/série. Ajuste a numeração em Regras Fiscais.",
    severity: "block",
  },
  "610": {
    title: "Total da NF-e diverge do somatório dos itens",
    action: "Recalcule os totais antes de reemitir.",
    severity: "block",
  },
  "656": {
    title: "Consumo indevido (rate limit)",
    action:
      "Muitas emissões seguidas — aguarde antes de tentar novamente.",
    severity: "retry",
  },
  "999": {
    title: "Erro não catalogado",
    action:
      "Consulte o motivo detalhado retornado pela SEFAZ.",
    severity: "block",
  },
  VALIDATION: {
    title: "Falha de validação interna",
    action: "Corrija os campos apontados antes de reenviar.",
    severity: "block",
  },
};

const CODE_REGEX = /(?:^|[^0-9])(\d{3})(?:\s*[-:–]\s*|\s+)/;

export function extractRejectionCode(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const match = reason.match(CODE_REGEX);
  return match ? match[1] : null;
}

export function parseRejection(
  code: string | null | undefined,
  reason: string | null | undefined,
): RejectionInfo {
  const finalCode = code?.trim() || extractRejectionCode(reason);
  if (finalCode && SEFAZ_MAP[finalCode]) {
    return { code: finalCode, ...SEFAZ_MAP[finalCode] };
  }
  return {
    code: finalCode,
    title: reason?.slice(0, 80) ?? "Rejeição sem código catalogado",
    action:
      "Consulte o motivo completo abaixo e ajuste os dados antes de reemitir.",
    severity: "block",
  };
}

export const KNOWN_REJECTION_CODES = Object.keys(SEFAZ_MAP).filter(
  (c) => c !== "VALIDATION",
);
