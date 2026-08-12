export class NcmValidator {
  static validate(ncm: string | null | undefined): void {
    if (!ncm) throw new Error("NCM não informado.");
    const clean = ncm.replace(/\D/g, "");
    if (clean.length !== 8) {
      throw new Error(`NCM "${ncm}" inválido. Deve ter 8 dígitos.`);
    }
  }
}

export class CestValidator {
  static validate(cest: string | null | undefined): void {
    if (!cest) return; // Opcional
    const clean = cest.replace(/\D/g, "");
    if (clean.length !== 7) {
      throw new Error(`CEST "${cest}" inválido. Deve ter 7 dígitos.`);
    }
  }
}

export class CfopValidator {
  static validate(cfop: string | null | undefined): void {
    if (!cfop) throw new Error("CFOP não informado.");
    const clean = cfop.replace(/\D/g, "");
    if (clean.length !== 4) {
      throw new Error(`CFOP "${cfop}" inválido. Deve ter 4 dígitos.`);
    }
  }
}
