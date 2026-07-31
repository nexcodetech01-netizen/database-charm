/**
 * Barrel público do módulo Products v2 (Sprint 002).
 */
export { ProductRepository } from "./repository/product.repository";
export type {
  ProductSearchFilters,
  ProductSearchResult,
} from "./repository/product.repository";

export { ProductService } from "./service/product.service";
export type {
  CreateProductInput,
  UpdatePriceInput,
  UpdateStockInput,
} from "./service/product.service";

export {
  productV2BaseSkills,
  productCreateSkill,
  productSearchSkill,
  productUpdatePriceSkill,
  productUpdateStockSkill,
  productListLowStockSkill,
} from "./skills";

export { adaptBaseSkillToBella } from "./bella-adapter";

export {
  parseProductsCsv,
  ParsedProductRowSchema,
  type ParsedProductRow,
  type CsvParseResult,
  type CsvIssue,
} from "./csv/product-csv";
