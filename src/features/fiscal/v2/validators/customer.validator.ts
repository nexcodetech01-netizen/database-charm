export class CustomerValidator {
  static validate(customer: any, model: "55" | "65"): void {
    if (model === "55") {
      this.validateForNfe(customer);
    } else {
      this.validateForNfce(customer);
    }
  }

  private static validateForNfe(customer: any): void {
    if (!customer) {
      throw new Error("Destinatário é obrigatório para NF-e (Modelo 55).");
    }

    if (!customer.document) {
      throw new Error("Documento (CPF/CNPJ) do destinatário é obrigatório.");
    }

    if (!customer.name) {
      throw new Error("Nome/Razão Social do destinatário é obrigatório.");
    }

    if (!customer.address || !customer.address.street || !customer.address.city || !customer.address.state || !customer.address.zip) {
      throw new Error("Endereço completo do destinatário é obrigatório para NF-e.");
    }
  }

  private static validateForNfce(customer: any): void {
    // Para NFC-e o cliente é opcional até certo valor, mas se informado deve ser válido
    if (customer && customer.document) {
      const doc = customer.document.replace(/\D/g, "");
      if (doc.length !== 11 && doc.length !== 14) {
        throw new Error("CPF/CNPJ do destinatário inválido.");
      }
    }
  }
}
