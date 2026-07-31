/**
 * Fiscal v2 — Resolução dos grupos de tributos por item (ICMS / PIS / COFINS).
 *
 * Motivo: rejeição SEFAZ 745 ("NF-e sem grupo do PIS [nItem:n]") ocorre quando
 * o payload enviado ao provedor não contém a situação tributária de PIS/COFINS
 * do item — o provedor então omite os grupos <PIS>/<COFINS> no XML.
 *
 * Regra: TODO item sempre carrega os três grupos, mesmo com valor zero.
 * O CST/CSOSN é derivado do CRT da empresa:
 *  - CRT 1/2 (Simples Nacional)  → CSOSN ICMS (102 padrão) + PIS/COFINS CST 49 zerados
 *  - CRT 4   (MEI)               → CSOSN ICMS (102 padrão) + PIS/COFINS CST 49 zerados
 *                                  (MEI NUNCA destaca PIS/COFINS — nunca tratar como normal)
 *  - CRT 3   (Regime Normal)     → CST ICMS (41 padrão) + PIS/COFINS CST 01 com alíquota
 *
 * Módulo puro: usado tanto pelo mapper Focus quanto pela pré-validação.
 */


export interface ItemTaxInput {
  /** CST/CSOSN de ICMS já definido no produto/venda, se houver. */
  cst?: string | null;
  /** Base de cálculo de PIS/COFINS (normalmente o valor bruto do item). */
  amount: number;
  origem?: number | null;
}

export interface ItemTaxGroups {
  icms: {
    situacaoTributaria: string;
    origem: number;
    modalidadeBaseCalculo?: number;
  };
  pis: {
    situacaoTributaria: string;
    baseCalculo: number;
    aliquotaPercentual: number;
    valor: number;
  };
  cofins: {
    situacaoTributaria: string;
    baseCalculo: number;
    aliquotaPercentual: number;
    valor: number;
  };
}

/** Alíquotas do regime normal (cumulativo padrão). */
const PIS_RATE_NORMAL = 1.65;
const COFINS_RATE_NORMAL = 7.6;

/** CRT 4 — Microempreendedor Individual (MEI). */
export function isMei(crt: number | null | undefined): boolean {
  return crt === 4;
}

/**
 * Regimes que NÃO destacam PIS/COFINS no item: Simples Nacional (1/2) e MEI (4).
 * `null`/`undefined` mantém o comportamento legado (Simples) apenas para
 * módulos puros; a emissão real bloqueia CRT ausente antes de chegar aqui.
 */
export function isSimplesNacional(crt: number | null | undefined): boolean {
  const value = crt ?? 1;
  return value === 1 || value === 2 || value === 4;
}

function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function resolveItemTaxes(
  crt: number | null | undefined,
  input: ItemTaxInput,
  fallbackCsosn?: string | null,
): ItemTaxGroups {
  const mei = isMei(crt);
  // MEI (4) e Simples (1/2) compartilham a mesma mecânica de CSOSN + CST 49.
  const csosnRegime = mei || isSimplesNacional(crt);
  const base = round2(Math.max(0, input.amount ?? 0));
  const origem = input.origem ?? 0;

  const icms = csosnRegime
    ? {
        situacaoTributaria: input.cst ?? fallbackCsosn ?? "102",
        origem,
      }
    : {
        situacaoTributaria: input.cst ?? fallbackCsosn ?? "41",
        origem,
        modalidadeBaseCalculo: 3,
      };

  if (csosnRegime) {
    // Simples Nacional e MEI: PISOutr / COFINSOutr zerados (grupo sempre
    // presente, sem destaque de alíquota). MEI nunca calcula como normal.
    return {
      icms,
      pis: { situacaoTributaria: "49", baseCalculo: 0, aliquotaPercentual: 0, valor: 0 },
      cofins: { situacaoTributaria: "49", baseCalculo: 0, aliquotaPercentual: 0, valor: 0 },
    };
  }


  return {
    icms,
    pis: {
      situacaoTributaria: "01",
      baseCalculo: base,
      aliquotaPercentual: PIS_RATE_NORMAL,
      valor: round2((base * PIS_RATE_NORMAL) / 100),
    },
    cofins: {
      situacaoTributaria: "01",
      baseCalculo: base,
      aliquotaPercentual: COFINS_RATE_NORMAL,
      valor: round2((base * COFINS_RATE_NORMAL) / 100),
    },
  };
}

/** Campos aceitos pela API Focus NFe (v2) para os grupos do item. */
export function toFocusTaxFields(groups: ItemTaxGroups): Record<string, unknown> {
  return {
    icms_origem: groups.icms.origem,
    icms_situacao_tributaria: groups.icms.situacaoTributaria,
    ...(groups.icms.modalidadeBaseCalculo != null
      ? { icms_modalidade_base_calculo: groups.icms.modalidadeBaseCalculo }
      : {}),
    pis_situacao_tributaria: groups.pis.situacaoTributaria,
    pis_base_calculo: groups.pis.baseCalculo,
    pis_aliquota_porcentual: groups.pis.aliquotaPercentual,
    pis_valor: groups.pis.valor,
    cofins_situacao_tributaria: groups.cofins.situacaoTributaria,
    cofins_base_calculo: groups.cofins.baseCalculo,
    cofins_aliquota_porcentual: groups.cofins.aliquotaPercentual,
    cofins_valor: groups.cofins.valor,
  };
}
