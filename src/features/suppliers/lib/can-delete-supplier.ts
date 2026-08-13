import type { SupplierWithMeta } from "../types";

/**
 * Trava de integridade: um fornecedor não pode ser excluído
 * permanentemente se tiver produtos ou compras vinculados.
 *
 * Bug real (2026-08-13, auditoria de Fornecedores): a checagem original
 * só olhava `products_count`. A foreign key `purchases.supplier_id` usa
 * `ON DELETE SET NULL` — ou seja, excluir um fornecedor sem produtos
 * vinculados mas COM histórico de compras não dava erro nenhum, só
 * apagava silenciosamente o fornecedor de todas as compras antigas
 * (perdendo a rastreabilidade de quem forneceu o quê no passado).
 */
export function canDeleteSupplier(
  s: Pick<SupplierWithMeta, "products_count" | "purchases_count" | "name">,
): { allowed: true } | { allowed: false; reason: string } {
  if (s.products_count > 0) {
    return {
      allowed: false,
      reason: `Este fornecedor está vinculado a ${s.products_count} produto(s). Arquive em vez de excluir.`,
    };
  }
  if (s.purchases_count > 0) {
    return {
      allowed: false,
      reason: `Este fornecedor tem ${s.purchases_count} compra(s) no histórico. Excluir apagaria o fornecedor desses registros. Arquive em vez de excluir.`,
    };
  }
  return { allowed: true };
}
