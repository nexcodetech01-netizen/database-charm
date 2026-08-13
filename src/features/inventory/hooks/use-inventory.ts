import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { inventoryService } from "../services/inventory.service";
import type { InventoryMovementInsert, MovementListFilters } from "../types";

export const inventoryKeys = {
  all: ["inventory"] as const,
  list: (companyId: string, f: MovementListFilters) =>
    ["inventory", "list", companyId, f] as const,
  metrics: (companyId: string) => ["inventory", "metrics", companyId] as const,
  recent: (companyId: string) => ["inventory", "recent", companyId] as const,
  byProduct: (productId: string) => ["inventory", "product", productId] as const,
  ledger: (companyId: string) => ["inventory", "ledger-audit", companyId] as const,
  reconciliation: (companyId: string) => ["inventory", "reconciliation", companyId] as const,
  costSettings: (companyId: string) => ["inventory", "cost-settings", companyId] as const,
};

export function useInventoryLedgerAudit(companyId: string) {
  return useQuery({
    queryKey: inventoryKeys.ledger(companyId),
    queryFn: () => inventoryService.ledgerAudit(companyId),
    enabled: !!companyId,
  });
}

export function useReconciliationHistory(companyId: string) {
  return useQuery({
    queryKey: inventoryKeys.reconciliation(companyId),
    queryFn: () => inventoryService.reconciliationHistory(companyId),
    enabled: !!companyId,
  });
}

export function useReconcileInventory(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dryRun: boolean) => inventoryService.reconcileOpening(companyId, dryRun),
    onSuccess: async (res) => {
      if (res.dry_run) return;
      await Promise.all([
        qc.invalidateQueries({ queryKey: inventoryKeys.all, refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["products"], refetchType: "all" }),
      ]);
    },
  });
}

export function useInventoryCostSettings(companyId: string) {
  return useQuery({
    queryKey: inventoryKeys.costSettings(companyId),
    queryFn: () => inventoryService.getCostSettings(companyId),
    enabled: !!companyId,
  });
}

export function useUpdateInventoryCostSettings(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { allow_sale_without_cost?: boolean; cost_method?: "average" | "last_purchase" }) =>
      inventoryService.updateCostSettings(companyId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: inventoryKeys.costSettings(companyId) });
    },
  });
}

export function useMovementsList(companyId: string, filters: MovementListFilters) {
  return useQuery({
    queryKey: inventoryKeys.list(companyId, filters),
    queryFn: () => inventoryService.list(companyId, filters),
  });
}

export function useInventoryMetrics(companyId: string) {
  return useQuery({
    queryKey: inventoryKeys.metrics(companyId),
    queryFn: () => inventoryService.metrics(companyId),
  });
}

export function useRecentMovements(companyId: string, limit = 8) {
  return useQuery({
    queryKey: inventoryKeys.recent(companyId),
    queryFn: () => inventoryService.recent(companyId, limit),
  });
}

export function useProductMovements(productId: string) {
  return useQuery({
    queryKey: inventoryKeys.byProduct(productId),
    queryFn: () => inventoryService.byProduct(productId),
    enabled: !!productId,
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InventoryMovementInsert) => inventoryService.create(input),
    onSuccess: async (_d, vars) => {
      // Refetch em toda a árvore (incluindo queries inativas) para que ao
      // reabrir a tela o saldo já esteja atualizado — não apenas a ativa.
      await Promise.all([
        qc.invalidateQueries({ queryKey: inventoryKeys.all, refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["products"], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["inv-product-picker"], refetchType: "all" }),
        vars.product_id
          ? qc.invalidateQueries({
              queryKey: ["products", "detail", vars.product_id],
              refetchType: "all",
            })
          : Promise.resolve(),
      ]);
    },
  });
}
