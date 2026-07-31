/**
 * Barrel das Skills v2 do módulo Products.
 */
export { productCreateSkill, productCreateSchema } from "./product-create.skill";
export { productSearchSkill, productSearchSchema } from "./product-search.skill";
export {
  productUpdatePriceSkill,
  productUpdatePriceSchema,
} from "./product-update-price.skill";
export {
  productUpdateStockSkill,
  productUpdateStockSchema,
} from "./product-update-stock.skill";
export {
  productListLowStockSkill,
  productListLowStockSchema,
} from "./product-list-low-stock.skill";

import { productCreateSkill } from "./product-create.skill";
import { productSearchSkill } from "./product-search.skill";
import { productUpdatePriceSkill } from "./product-update-price.skill";
import { productUpdateStockSkill } from "./product-update-stock.skill";
import { productListLowStockSkill } from "./product-list-low-stock.skill";

export const productV2BaseSkills = [
  productCreateSkill,
  productSearchSkill,
  productUpdatePriceSkill,
  productUpdateStockSkill,
  productListLowStockSkill,
] as const;
