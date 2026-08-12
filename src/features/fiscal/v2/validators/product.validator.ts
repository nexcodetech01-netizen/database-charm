import { NcmValidator } from "./codes.validator";
import { CestValidator } from "./codes.validator";

export class ProductValidator {
  static validateItem(item: any): void {
    if (!item.description) {
      throw new Error("Item sem descrição.");
    }

    NcmValidator.validate(item.ncm);
    CestValidator.validate(item.cest);

    if (!(item.quantity > 0)) {
      throw new Error("Quantidade inválida.");
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
