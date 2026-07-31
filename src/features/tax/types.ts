/**
 * Motor Tributário — contratos de tipos.
 *
 * Todos os valores vêm do banco (perfil tributário, vendas reais e
 * lançamentos contábeis). Nada aqui é mockado.
 */

export type TaxRegime = "simples_nacional" | "lucro_presumido" | "lucro_real" | "mei";
export type SimplesAnnex = "I" | "II" | "III" | "IV" | "V";
export type ApportionmentStatus = "open" | "closed" | "paid" | "cancelled";

export interface CompanyTaxProfile {
  id: string;
  companyId: string;
  taxRegime: TaxRegime;
  simplesAnnex: SimplesAnnex | null;
  rbt12: number;
  effectiveRate: number;
  nominalRate: number;
  icmsRegime: string;
  pisRegime: string;
  cofinsRegime: string;
  issRegime: string;
  ipiRegime: string;
  dueDay: number;
  startDate: string;
  active: boolean;
}

export type CompanyTaxProfileInput = Partial<
  Omit<CompanyTaxProfile, "id" | "companyId">
> & { taxRegime: TaxRegime };

export interface SimplesBracket {
  annex: SimplesAnnex;
  bracket: number;
  rbt12From: number;
  rbt12To: number | null;
  nominalRate: number;
  deduction: number;
}

export interface SimplesComputation {
  annex: SimplesAnnex;
  bracket: number;
  rbt12: number;
  revenue: number;
  nominalRate: number;
  deduction: number;
  effectiveRate: number;
  taxAmount: number;
  limitUsagePct: number;
}

export interface TaxApportionment {
  id: string;
  companyId: string;
  competence: string;
  taxRegime: TaxRegime;
  simplesAnnex: SimplesAnnex | null;
  bracket: number | null;
  revenue: number;
  baseAmount: number;
  rbt12: number;
  nominalRate: number;
  deduction: number;
  effectiveRate: number;
  taxAmount: number;
  dueDate: string | null;
  status: ApportionmentStatus;
  entryId: string | null;
}

export interface TaxScenario {
  growthPct: number;
  revenue: number;
  taxAmount: number;
  effectiveRate: number;
  bracket: number | null;
  cogs: number;
  operatingExpenses: number;
  netProfit: number;
  netMargin: number;
}

export interface TaxProjection {
  competence: string;
  baseRevenue: number;
  rbt12: number;
  scenarios: TaxScenario[];
}

export type TaxAlertLevel = "info" | "warning" | "critical";

export interface TaxAlert {
  id: string;
  level: TaxAlertLevel;
  title: string;
  description: string;
}
