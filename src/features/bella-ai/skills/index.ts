/**
 * Bella IA — Skills bootstrap
 *
 * Registra todas as Skills disponíveis no BellaSkillRegistry no
 * momento em que este módulo é importado. Nenhum consumidor precisa
 * conhecer a lista — basta usar o Registry.
 */

export * from "./types";
export { BellaSkillRegistry } from "./registry";

import { BellaSkillRegistry } from "./registry";
import { financeSkills } from "./finance-skills";
import { customerSkills } from "./customer-skills";
import { productSkills } from "./product-skills";
import { agendaSkills } from "./agenda-skills";
import { serviceOrderSkills } from "./service-order-skills";
import { quoteSkills } from "./quote-skills";
import { accountingSkills } from "./accounting-skills";
import { taxSkills } from "./tax-skills";
import { executiveSkills } from "../executive/skills/executive-skills";
import { productV2BaseSkills, adaptBaseSkillToBella } from "@/features/products/v2";
import { stockV2BaseSkills } from "@/features/inventory/v2";
import { salesV2BaseSkills } from "@/features/sales/v2";
import { financeV2BaseSkills } from "@/features/finance/v2";
import { fiscalV2BaseSkills } from "@/features/fiscal/v2/skills";

// Sprint 002 — sobrepõe as skills v2 do módulo Products via adapter
// BaseSkill → BellaSkill. O Map do Registry substitui pelas versões v2
// para os ids compartilhados (product.create, product.find sobrescrito
// por product.search, product.update_stock).
const productV2Adapted = productV2BaseSkills.map((s) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adaptBaseSkillToBella(s as any),
);

// Sprint 003 — Skills v2 de Estoque (stock.*) via mesmo adapter.
const stockV2Adapted = stockV2BaseSkills.map((s) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adaptBaseSkillToBella(s as any),
);

// Sprint 005 — Skills v2 de Vendas (sale.*) via mesmo adapter.
const salesV2Adapted = salesV2BaseSkills.map((s) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adaptBaseSkillToBella(s as any),
);

// Sprint 006 — Skills v2 de Financeiro (finance.*) via mesmo adapter.
const financeV2Adapted = financeV2BaseSkills.map((s) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adaptBaseSkillToBella(s as any),
);

// Sprint 007 — Skills v2 do Fiscal (fiscal.*) via mesmo adapter.
const fiscalV2Adapted = fiscalV2BaseSkills.map((s) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adaptBaseSkillToBella(s as any),
);

/**
 * Inicializa e registra todas as skills no Registry.
 * Chamado pelo registry.ensureInitialized() para garantir ordem de carga.
 */
export function initializeSkills(): void {
  
  BellaSkillRegistry.registerAll([
    ...financeSkills,
    ...customerSkills,
    ...productSkills,
    ...agendaSkills,
    ...serviceOrderSkills,
    ...quoteSkills,
    ...accountingSkills,
    ...taxSkills,
    ...executiveSkills,
  ]);

  // Registra as v2 por último para sobrescrever ids repetidos.
  for (const s of productV2Adapted) BellaSkillRegistry.register(s);
  for (const s of stockV2Adapted) BellaSkillRegistry.register(s);
  for (const s of salesV2Adapted) BellaSkillRegistry.register(s);
  for (const s of financeV2Adapted) BellaSkillRegistry.register(s);
  for (const s of fiscalV2Adapted) BellaSkillRegistry.register(s);
}


export {
  financeSkills,
  customerSkills,
  productSkills,
  agendaSkills,
  serviceOrderSkills,
  quoteSkills,
  accountingSkills,
  taxSkills,
  executiveSkills,
  productV2Adapted,
  stockV2Adapted,
  salesV2Adapted,
  financeV2Adapted,
  fiscalV2Adapted,
};
