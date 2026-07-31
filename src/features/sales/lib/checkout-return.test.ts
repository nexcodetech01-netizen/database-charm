import { describe, expect, it, vi } from "vitest";
import { returnToSaleItems } from "./checkout-return";

describe("returnToSaleItems", () => {
  it("retorna ao editor antes de aguardar a reversão do status", () => {
    const events: string[] = [];
    const rollback = new Promise<void>(() => undefined);

    returnToSaleItems({
      prepareEditor: () => events.push("prepare-editor"),
      closeCheckout: () => events.push("close-checkout"),
      rollbackSaleStatus: () => {
        events.push("rollback-started");
        return rollback;
      },
    });

    expect(events).toEqual([
      "prepare-editor",
      "close-checkout",
      "rollback-started",
    ]);
  });

  it("mantém o editor aberto quando a reversão de status falha", async () => {
    const error = new Error("network unavailable");
    const onRollbackError = vi.fn();
    const prepareEditor = vi.fn();
    const closeCheckout = vi.fn();

    returnToSaleItems({
      prepareEditor,
      closeCheckout,
      rollbackSaleStatus: () => Promise.reject(error),
      onRollbackError,
    });
    await Promise.resolve();

    expect(prepareEditor).toHaveBeenCalledOnce();
    expect(closeCheckout).toHaveBeenCalledOnce();
    expect(onRollbackError).toHaveBeenCalledWith(error);
  });

  it("sinaliza quando a reversão termina", async () => {
    const onRollbackSettled = vi.fn();

    returnToSaleItems({
      prepareEditor: vi.fn(),
      closeCheckout: vi.fn(),
      rollbackSaleStatus: () => Promise.resolve(),
      onRollbackSettled,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(onRollbackSettled).toHaveBeenCalledOnce();
  });
});