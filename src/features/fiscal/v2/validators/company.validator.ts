import { isValidCrt, CRT_BY_REGIME, type FiscalTaxRegime } from "../lib/crt";

export class CompanyValidator {
  static validateCrt(crt: number | null | undefined, regime?: string | null): void {
    if (!isValidCrt(crt)) {
      throw new Error("CRT da empresa não configurado ou inválido.");
    }
    
    if (regime) {
      const allowed = CRT_BY_REGIME[regime as FiscalTaxRegime];
      if (allowed && !allowed.includes(crt)) {
        throw new Error(`CRT ${crt} é incompatível com o regime ${regime}.`);
      }
    }
  }

  static validateFiscalSettings(settings: any): void {
    if (!settings) {
      throw new Error("Configurações fiscais não encontradas.");
    }
    
    if (!settings.crt) {
      throw new Error("Regime Tributário (CRT) não configurado.");
    }

    if (!settings.nfe_series && !settings.nfce_series) {
      throw new Error("Série de emissão não configurada.");
    }
  }

  static validateEmitterData(emitter: any): void {
    const required = ["cnpj", "legalName", "street", "number", "district", "city", "state", "zip"];
    for (const field of required) {
      if (!emitter[field]) {
        throw new Error(`Dados do emitente incompletos: campo ${field} é obrigatório.`);
      }
    }

    if (emitter.cnpj && emitter.cnpj.replace(/\D/g, "").length !== 14) {
      throw new Error("CNPJ do emitente inválido.");
    }
  }
}
