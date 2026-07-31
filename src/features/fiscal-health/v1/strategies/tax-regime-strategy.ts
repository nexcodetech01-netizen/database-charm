/**
 * Sprint 008.1 — Strategy Pattern para regras específicas de cada regime tributário.
 *
 * Cada regime expõe:
 *  - Limite anual padrão (quando aplicável)
 *  - Se possui limite de faturamento
 *  - Rótulo humano
 *  - Recomendações contextuais (usadas pelo BellaFiscalAdvisor)
 */

export type TaxRegime = "mei" | "simples" | "presumido" | "real";

export interface TaxRegimeStrategy {
  readonly regime: TaxRegime;
  readonly label: string;
  readonly hasAnnualLimit: boolean;
  /** Limite anual padrão em BRL, quando aplicável. */
  readonly defaultAnnualLimit: number | null;
  /** Percentuais padrão de alerta (usados quando o usuário não configurou). */
  readonly defaultAlertThresholds: readonly number[];
  /** Recomendação humana quando o percentual utilizado ultrapassa cada threshold. */
  buildAdvisorMessage(percentUsed: number, remaining: number, projectionMonth?: string | null): string | null;
}

class MeiStrategy implements TaxRegimeStrategy {
  readonly regime = "mei" as const;
  readonly label = "MEI";
  readonly hasAnnualLimit = true;
  readonly defaultAnnualLimit = 81_000; // limite MEI padrão (configurável pelo usuário)
  readonly defaultAlertThresholds = [70, 80, 90, 95, 100] as const;

  buildAdvisorMessage(percentUsed: number, remaining: number, projectionMonth?: string | null): string | null {
    if (percentUsed >= 100) {
      return "Você já atingiu 100% do limite MEI. Converse com sua contadora imediatamente sobre migração para Simples Nacional.";
    }
    if (percentUsed >= 95) {
      return `Faltam R$ ${remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para atingir o limite MEI. Risco tributário elevado.`;
    }
    if (percentUsed >= 90) {
      return "Você utilizou mais de 90% do limite anual. Considere planejar a transição de regime.";
    }
    if (percentUsed >= 80) {
      return `Você utilizou ${percentUsed.toFixed(0)}% do limite anual.${projectionMonth ? ` No ritmo atual, o limite deve ser atingido em ${projectionMonth}.` : ""}`;
    }
    if (percentUsed >= 70) {
      return "Atenção: passou de 70% do limite anual MEI. Acompanhe de perto o faturamento dos próximos meses.";
    }
    return null;
  }
}

class SimplesStrategy implements TaxRegimeStrategy {
  readonly regime = "simples" as const;
  readonly label = "Simples Nacional";
  readonly hasAnnualLimit = true;
  readonly defaultAnnualLimit = 4_800_000;
  readonly defaultAlertThresholds = [70, 80, 90, 95, 100] as const;

  buildAdvisorMessage(percentUsed: number, remaining: number, projectionMonth?: string | null): string | null {
    if (percentUsed >= 100) {
      return "Você ultrapassou o limite do Simples Nacional. Consulte sua contadora sobre desenquadramento e migração para Lucro Presumido/Real.";
    }
    if (percentUsed >= 95) {
      return `Faltam apenas R$ ${remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para o teto do Simples. Planeje o desenquadramento.`;
    }
    if (percentUsed >= 90) {
      return "Acima de 90% do teto do Simples — sublimite estadual e federal em risco.";
    }
    if (percentUsed >= 80) {
      return `Você utilizou ${percentUsed.toFixed(0)}% do limite anual.${projectionMonth ? ` Projeção indica atingir o teto em ${projectionMonth}.` : ""}`;
    }
    if (percentUsed >= 70) {
      return "Atenção: passou de 70% do limite do Simples. Acompanhe faixas de alíquota.";
    }
    return null;
  }
}

class PresumidoStrategy implements TaxRegimeStrategy {
  readonly regime = "presumido" as const;
  readonly label = "Lucro Presumido";
  readonly hasAnnualLimit = true;
  readonly defaultAnnualLimit = 78_000_000; // teto para permanência no Presumido
  readonly defaultAlertThresholds = [70, 85, 95, 100] as const;

  buildAdvisorMessage(percentUsed: number, remaining: number, projectionMonth?: string | null): string | null {
    if (percentUsed >= 100) {
      return "Faturamento ultrapassou o teto do Lucro Presumido. Migração para Lucro Real é obrigatória no exercício seguinte.";
    }
    if (percentUsed >= 95) {
      return `Faltam R$ ${remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} para o teto do Presumido. Prepare-se para o Lucro Real.`;
    }
    if (percentUsed >= 85) {
      return `Você utilizou ${percentUsed.toFixed(0)}% do teto anual.${projectionMonth ? ` Projeção indica atingir em ${projectionMonth}.` : ""}`;
    }
    if (percentUsed >= 70) {
      return "Acompanhe a evolução: acima de 70% do teto anual do Presumido.";
    }
    return null;
  }
}

class RealStrategy implements TaxRegimeStrategy {
  readonly regime = "real" as const;
  readonly label = "Lucro Real";
  /** Sem teto de permanência — usa-se limite apenas se configurado manualmente. */
  readonly hasAnnualLimit = false;
  readonly defaultAnnualLimit = null;
  readonly defaultAlertThresholds = [70, 85, 100] as const;

  buildAdvisorMessage(percentUsed: number, _remaining: number, projectionMonth?: string | null): string | null {
    if (!Number.isFinite(percentUsed)) return null;
    if (percentUsed >= 100) {
      return "Faturamento ultrapassou a meta anual configurada. Revise projeções e planejamento tributário.";
    }
    if (percentUsed >= 85) {
      return `Meta anual em ${percentUsed.toFixed(0)}%.${projectionMonth ? ` Ritmo atual projeta atingir em ${projectionMonth}.` : ""}`;
    }
    return null;
  }
}

const STRATEGIES: Record<TaxRegime, TaxRegimeStrategy> = {
  mei: new MeiStrategy(),
  simples: new SimplesStrategy(),
  presumido: new PresumidoStrategy(),
  real: new RealStrategy(),
};

export function getRegimeStrategy(regime: TaxRegime): TaxRegimeStrategy {
  return STRATEGIES[regime] ?? STRATEGIES.simples;
}

export function listRegimes(): TaxRegimeStrategy[] {
  return Object.values(STRATEGIES);
}
