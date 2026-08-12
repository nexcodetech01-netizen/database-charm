export class TaxValidator {
  static validateCfop(cfop: string | null | undefined): void {
    if (!cfop) {
      throw new Error("CFOP não informado.");
    }
    if (cfop.replace(/\D/g, "").length !== 4) {
      throw new Error(`CFOP "${cfop}" inválido. Deve ter 4 dígitos.`);
    }
  }

  static validateTaxGroups(groups: any): void {
    if (!groups.icms || !groups.icms.situacaoTributaria) {
      throw new Error("Grupo de ICMS inválido ou incompleto.");
    }
    if (!groups.pis || !groups.pis.situacaoTributaria) {
      throw new Error("Grupo de PIS inválido ou incompleto.");
    }
    if (!groups.cofins || !groups.cofins.situacaoTributaria) {
      throw new Error("Grupo de COFINS inválido ou incompleto.");
    }
  }
}
