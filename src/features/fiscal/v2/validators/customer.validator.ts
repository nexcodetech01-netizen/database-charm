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
      throw new Error("Cliente sem nome.");
    }

    if (!customer.name) {
      throw new Error("Cliente sem nome.");
    }

    if (!customer.document) {
      throw new Error("Cliente sem CPF/CNPJ.");
    }

    if (!customer.address || !customer.address.street || !customer.address.city || !customer.address.state || !customer.address.zip) {
      throw new Error("Endereço do cliente incompleto.");
    }
  }

  private static validateForNfce(customer: any): void {
    if (customer && customer.document && !customer.name) {
      throw new Error("Cliente sem nome.");
    }
  }
}
