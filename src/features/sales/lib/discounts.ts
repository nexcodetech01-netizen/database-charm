/**
 * lib/discounts — superfície única da política de descontos.
 *
 * Reexporta `discount-policy` para que o Engine e futuros consumidores
 * (PDV) não dependam do caminho interno do arquivo.
 */
export {
  DEFAULT_DISCOUNT_POLICY,
  readDiscountPolicy,
  writeDiscountPolicy,
  useDiscountPolicy,
  evaluateDiscount,
} from "./discount-policy";
export type {
  DiscountEnforcement,
  DiscountPolicy,
  DiscountEvaluation,
} from "./discount-policy";
