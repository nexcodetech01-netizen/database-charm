export class CertificateValidator {
  static validate(certificate: any): void {
    if (!certificate) {
      throw new Error("Certificado Digital A1 não encontrado ou não configurado.");
    }

    if (!certificate.is_active && certificate.isActive !== true) {
      // Suporta ambos os formatos de prop
      throw new Error("O certificado digital selecionado não está ativo.");
    }

    if (certificate.valid_to || certificate.validTo) {
      const expiry = new Date(certificate.valid_to || certificate.validTo);
      if (expiry < new Date()) {
        throw new Error(`Certificado expirou em ${expiry.toLocaleDateString()}.`);
      }
    }
  }
}
