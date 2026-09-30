/**
 * Barrel das Skills v2 do módulo Vendas (Sprint 005).
 */
export { saleCreateSkill, saleCreateSchema } from "./sale-create.skill";
export { saleSearchSkill, saleSearchSchema } from "./sale-search.skill";
export { saleCancelSkill, saleCancelSchema } from "./sale-cancel.skill";
export { saleQuoteSkill, saleQuoteSchema } from "./sale-quote.skill";
export { saleMarginSkill, saleMarginSchema } from "./sale-margin.skill";
export { saleProductsSoldSkill, saleProductsSoldSchema } from "./sale-products-sold.skill";
export {
  saleBestCustomerSkill,
  saleBestCustomerSchema,
} from "./sale-best-customer.skill";

import { saleCreateSkill } from "./sale-create.skill";
import { saleSearchSkill } from "./sale-search.skill";
import { saleCancelSkill } from "./sale-cancel.skill";
import { saleQuoteSkill } from "./sale-quote.skill";
import { saleMarginSkill } from "./sale-margin.skill";
import { saleBestCustomerSkill } from "./sale-best-customer.skill";
import { saleProductsSoldSkill } from "./sale-products-sold.skill";

export const salesV2BaseSkills = [
  saleCreateSkill,
  saleSearchSkill,
  saleCancelSkill,
  saleQuoteSkill,
  saleMarginSkill,
    saleBestCustomerSkill,
  saleProductsSoldSkill,
] as const;
