/**
 * useSalesCopilot — hook fino que expõe o SalesCopilot para a UI.
 * Não reimplementa nada; apenas guarda snapshot local e força
 * re-render após cada comando.
 */

import { useCallback, useMemo, useState } from "react";
import { salesCopilot } from "../SalesCopilot";
import type {
  SalesChannel,
  SalesCopilotContext,
  SalesCopilotResult,
  SalesCopilotSnapshot,
  SalesLineItem,
} from "../types";

export function useSalesCopilot(params: {
  tenantId: string;
  userId: string;
  channel?: SalesChannel;
}) {
  const ctx: SalesCopilotContext = useMemo(
    () => ({
      tenantId: params.tenantId,
      userId: params.userId,
      channel: params.channel ?? "chat",
    }),
    [params.tenantId, params.userId, params.channel],
  );

  const [snapshot, setSnapshot] = useState<SalesCopilotSnapshot>(() =>
    salesCopilot.snapshot(ctx),
  );

  const apply = useCallback(
    (result: SalesCopilotResult): SalesCopilotResult => {
      setSnapshot(result.snapshot);
      return result;
    },
    [],
  );

  return {
    ctx,
    snapshot,
    start: useCallback(() => apply(salesCopilot.start(ctx)), [apply, ctx]),
    findCustomer: useCallback(
      async (query: string) => apply(await salesCopilot.findCustomer(ctx, query)),
      [apply, ctx],
    ),
    createCustomer: useCallback(
      async (payload: Record<string, unknown>) =>
        apply(await salesCopilot.createCustomer(ctx, payload)),
      [apply, ctx],
    ),
    recommend: useCallback(
      (opts: Parameters<typeof salesCopilot.recommend>[1]) =>
        salesCopilot.recommend(ctx, opts),
      [ctx],
    ),
    addItem: useCallback(
      (item: SalesLineItem) => apply(salesCopilot.addItem(ctx, item)),
      [apply, ctx],
    ),
    removeItem: useCallback(
      (productId: string) => apply(salesCopilot.removeItem(ctx, productId)),
      [apply, ctx],
    ),
    changeQuantity: useCallback(
      (productId: string, quantity: number) =>
        apply(salesCopilot.changeQuantity(ctx, productId, quantity)),
      [apply, ctx],
    ),
    applyDiscount: useCallback(
      (percent: number) => apply(salesCopilot.applyDiscount(ctx, percent)),
      [apply, ctx],
    ),
    setPaymentMethod: useCallback(
      (method: string) => apply(salesCopilot.setPaymentMethod(ctx, method)),
      [apply, ctx],
    ),
    setNotes: useCallback(
      (notes: string) => apply(salesCopilot.setNotes(ctx, notes)),
      [apply, ctx],
    ),
    summary: useCallback(() => apply(salesCopilot.summary(ctx)), [apply, ctx]),
    confirm: useCallback(
      async () => apply(await salesCopilot.confirm(ctx)),
      [apply, ctx],
    ),
    cancel: useCallback(
      (reason?: string) => apply(salesCopilot.cancel(ctx, reason)),
      [apply, ctx],
    ),
    close: useCallback(() => {
      salesCopilot.close(ctx);
      setSnapshot(salesCopilot.snapshot(ctx));
    }, [ctx]),
  };
}
