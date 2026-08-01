/**
 * Bella Contadora — Auditoria: consultas determinísticas (somente leitura).
 */
import { describeAudit, describeFindings, describeOperationalHealth } from "./selectors";
import type { AuditSnapshot } from "./types";

export type AuditQueryId =
  | "auditoria_completa"
  | "inconsistencias"
  | "saude_operacional"
  | "problemas_criticos";

export interface AuditQueryAnswer {
  id: AuditQueryId;
  label: string;
  available: boolean;
  value: number | null;
  text: string;
}

export const auditQueries = {
  auditoriaCompleta(s: AuditSnapshot | null): AuditQueryAnswer {
    return {
      id: "auditoria_completa",
      label: "Auditoria completa",
      available: s !== null,
      value: s ? s.findings.length : null,
      text: describeAudit(s),
    };
  },
  inconsistencias(s: AuditSnapshot | null): AuditQueryAnswer {
    return {
      id: "inconsistencias",
      label: "Inconsistências",
      available: s !== null,
      value: s ? s.findings.length : null,
      text: describeFindings(s),
    };
  },
  saudeOperacional(s: AuditSnapshot | null): AuditQueryAnswer {
    return {
      id: "saude_operacional",
      label: "Saúde operacional",
      available: s !== null,
      value: s ? s.health.score : null,
      text: describeOperationalHealth(s),
    };
  },
  problemasCriticos(s: AuditSnapshot | null): AuditQueryAnswer {
    const criticals = (s?.findings ?? []).filter((f) => f.severity === "critical");
    return {
      id: "problemas_criticos",
      label: "Problemas críticos",
      available: s !== null,
      value: s ? criticals.length : null,
      text:
        s === null
          ? "Não consegui ler os dados para auditar agora."
          : criticals.length === 0
            ? "Nenhum problema crítico encontrado."
            : criticals.map((f) => `${f.title} (${f.count})`).join(" · "),
    };
  },
};
