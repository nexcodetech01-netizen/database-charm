export class ProductValidator {
  static validateItem(item: any): void {
    if (!item.description) {
      throw new Error("Descrição do produto é obrigatória.");
    }

    if (!item.ncm) {
      throw new Error(`NCM do produto "${item.description}" não informado.`);
    }

    if (item.ncm.replace(/\D/g, "").length !== 8) {
      throw new Error(`NCM "${item.ncm}" do produto "${item.description}" deve ter 8 dígitos.`);
    }

    if (!(item.quantity > 0)) {
      throw new Error(`Quantidade do produto "${item.description}" deve ser maior que zero.`);
    }

    if (item.unitPrice < 0) {
      throw new Error(`Preço unitário do produto "${item.description}" não pode ser negativo.`);
    }
  }

  static validateItems(items: any[]): void {
    if (!items || items.length === 0) {
      throw new Error("Venda sem itens.");
    }
    
    items.forEach(item => this.validateItem(item));
  }
}
